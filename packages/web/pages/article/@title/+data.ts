import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { articles, pageSimilarities, pages } from "@jigsaw/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { resolveArticleDate } from "@jigsaw/db/article-date";
import { pickRandom } from "@/utils/pickRandom";
import { routeTitleToPageTitle } from "@/utils/routeTitle";
import { buildArticleBody } from "./articleBody";

// bge-m3 の cosine は下駄が高く 0.5 未満がほぼ出ないため、絶対的な意味はない。
// ノイズ切りの調整つまみ。0.60 で全 article の 7% が候補 0 件になる。
const SIMILARITY_MIN = 0.6;
const RELATED_COUNT = 5;

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { title: string };
};

const data = async (c: Context) => {
  const config = useConfig();
  const title = routeTitleToPageTitle(c.routeParams.title);
  const db = getDB(c.env.DB);

  const pageInfo = await db
    .select({
      pageId: pages.id,
      articleId: articles.id,
      bodyKey: pages.bodyKey,
      created: pages.created,
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .where(eq(pages.title, title))
    .limit(1);

  const pageId = pageInfo[0]?.pageId ?? null;
  const bodyKey = pageInfo[0]?.bodyKey ?? "";
  const articleId = pageInfo[0]?.articleId ?? null;
  const created = pageInfo[0]?.created ?? "";

  // 関連記事。article でないページには出さない。
  let related: { title: string; image: string | null }[] = [];
  if (pageId !== null && articleId !== null) {
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
    config({
      title: `${title} - I am Electrical machine`,
    });
    return {
      ok: false as const,
      title,
      pageId,
      articleId,
      blocks: [],
      description: null,
      related: [],
    };
  }

  const built = buildArticleBody(body);
  const filteredBlocks = built.blocks;
  const description = built.description;
  const fromDate = resolveArticleDate({
    body,
    title,
    bodyKey,
    created,
  });

  config({
    title: `${title} - I am Electrical machine`,
    description,
  });

  return {
    ok: true as const,
    title,
    pageId,
    articleId,
    blocks: filteredBlocks,
    fromDate,
    description,
    related,
  };
};

export default data;
