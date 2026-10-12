import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { articles, clips, pageSimilarities, pages, zets } from "@jigsaw/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { BACKLINK_INITIAL, fetchBacklinks } from "@/server/backlinks";
import { useConfig } from "vike-react/useConfig";
import { render } from "vike/abort";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { resolveArticleDate } from "@jigsaw/db/article-date";
import { pickRandom } from "@/utils/pickRandom";
import { pageTitleFromUrl } from "@/utils/pageTitle";
import { buildArticleBody } from "./articleBody";
import { articleHeading } from "./heading";

// bge-m3 の cosine は下駄が高く 0.5 未満がほぼ出ないため、絶対的な意味はない。
// ノイズ切りの調整つまみ。0.60 で全 article の 7% が候補 0 件になる。
const SIMILARITY_MIN = 0.6;
const RELATED_COUNT = 5;

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context) => {
  const config = useConfig();
  const title = pageTitleFromUrl(c.urlOriginal);
  const db = getDB(c.env.DB);

  const pageInfo = await db
    .select({
      pageId: pages.id,
      articleId: articles.id,
      clipId: clips.id,
      clipKind: clips.kind,
      bodyKey: pages.bodyKey,
      created: pages.created,
      date: articles.date,
      zetId: zets.id,
      zetTitle: zets.title,
      zetDate: zets.date,
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .leftJoin(clips, eq(clips.pageID, pages.id))
    .leftJoin(zets, eq(zets.pageID, pages.id))
    .where(eq(pages.title, title))
    .limit(1);

  const pageId = pageInfo[0]?.pageId ?? null;
  const bodyKey = pageInfo[0]?.bodyKey ?? "";
  const articleId = pageInfo[0]?.articleId ?? null;
  const clipId = pageInfo[0]?.clipId ?? null;
  const zetId = pageInfo[0]?.zetId ?? null;
  // 引用を大きく出すか、動画を大きく出すかは kind だけで決める (+Page.tsx)。
  // clip でなければ null。
  const clipKind = pageInfo[0]?.clipKind ?? null;
  const created = pageInfo[0]?.created ?? "";
  // zet (diary の日々の断片) も記事と同じこのページで出す。zet.date は
  // NOT NULL なので、zetDate が null なら zet ではない。
  const zetDate = pageInfo[0]?.zetDate ?? null;
  const isZet = zetDate !== null;
  // 見出し・<title>・u-url の文字列。zet の page.title (zet:<rkey>) は出さない。
  const { heading, isName } = articleHeading({
    title,
    zetTitle: pageInfo[0]?.zetTitle ?? null,
    zetDate,
  });
  // zet の日付は zet.date (diary が決めた日)。本文から推さない。
  const storedDate = pageInfo[0]?.date ?? zetDate;

  // 関連記事。article と zet のページに出す (clip には出さない)。
  let related: { title: string; image: string | null }[] = [];
  if (pageId !== null && (articleId !== null || isZet)) {
    const candidates = await db
      .select({ title: pages.title, image: pages.image })
      .from(pageSimilarities)
      .innerJoin(pages, eq(pages.id, pageSimilarities.relatedPageID))
      .where(
        and(
          eq(pageSimilarities.pageID, pageId),
          gte(pageSimilarities.score, SIMILARITY_MIN),
          eq(
            pageSimilarities.runID,
            sql`(SELECT id FROM similarity_run WHERE current = 1)`,
          ),
        ),
      )
      .orderBy(desc(pageSimilarities.adjusted))
      .limit(20);
    related = pickRandom(candidates, RELATED_COUNT);
  }

  const body = await fetchBody(c.env.R2, bodyKey, title);

  if (body === null) {
    // 記事が無い題でも、そこへリンクしているページはある。行き止まりに
    // しないため、被リンクを出す (clip のページにも出す。下の ok 側)。
    // similarity は使えない (page_similarity の行は article を持つページに
    // しか作られない。ここに来る題はそもそも page 行が無い)。
    // クエリは API (/api/backlinks) と共有する。「もっと見る」で続きを
    // 引くとき、SSR と同じ絞り込み・同じ並びでなければページが繰れない。
    const { backlinks, hasMore } = await fetchBacklinks(
      db,
      title,
      0,
      BACKLINK_INITIAL,
    );
    // 本当に何も無い題は 404。200 で「Page not found」を返していると、壊れた
    // URL を外形監視のステータスチェックが見逃す。
    if (backlinks.length === 0) throw render(404);

    config({
      title: `${heading} - I am Electrical machine`,
    });
    return {
      ok: false as const,
      title,
      heading,
      pageId,
      articleId,
      clipId,
      zetId,
      clipKind,
      blocks: [],
      description: null,
      related: [],
      backlinks,
      hasMore,
    };
  }

  // clip と zet のページには被リンクを出す。clip は similarity の計算対象外で
  // related が空になり、下に何も出ないため。zet も記事ページの機能をそのまま
  // 出す。article のページには出さない。
  // SSR と「もっと見る」で同じ関数を通す理由は上の body === null 側と同じ。
  const { backlinks, hasMore } =
    clipId !== null || isZet
      ? await fetchBacklinks(db, title, 0, BACKLINK_INITIAL)
      : { backlinks: [], hasMore: false };

  const built = buildArticleBody(body);
  const filteredBlocks = built.blocks;
  const description = built.description;
  const fromDate =
    storedDate ??
    resolveArticleDate({
      body,
      title,
      bodyKey,
      created,
    });

  config({
    title: `${heading} - I am Electrical machine`,
    description,
  });

  return {
    ok: true as const,
    title,
    heading,
    isName,
    pageId,
    articleId,
    clipId,
    zetId,
    clipKind,
    blocks: filteredBlocks,
    fromDate,
    description,
    related,
    backlinks,
    hasMore,
  };
};

export default data;
