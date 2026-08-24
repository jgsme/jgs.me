import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { getDB } from "@/db/getDB";
import { articles, pageSimilarities, pages } from "@jigsaw/db";
import { bodyFormatOf, r2KeyOf } from "@jigsaw/db/body-key";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { pickRandom } from "@/utils/pickRandom";
import { routeTitleToPageTitle } from "@/utils/routeTitle";
import { buildArticleBody } from "./articleBody";
import { resolveFromDate } from "./fromDate";

// bge-m3 の cosine は下駄が高く 0.5 未満がほぼ出ないため、絶対的な意味はない。
// ノイズ切りの調整つまみ。0.60 で全 article の 7% が候補 0 件になる。
const SIMILARITY_MIN = 0.6;
const RELATED_COUNT = 5;

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { title: string };
};

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

// 戻り値は Scrapbox 記法のテキスト (1行目が題)。
async function fetchBody(
  r2: R2Bucket,
  bodyKey: string,
  title: string,
): Promise<string | null> {
  const key = r2KeyOf(bodyKey);
  // 空文字は「本文が存在しない」。R2 を引きに行かない。
  if (!key) {
    console.error(`[R2 skip] title=${title} (no bodyKey in DB)`);
    return null;
  }

  const obj = await r2.get(key);
  if (!obj) {
    console.error(`[R2 miss] title=${title}, key=${key}`);
    return null;
  }

  if (bodyFormatOf(bodyKey) === "micropub-sb") {
    return await obj.text();
  }

  const data = await obj.json<R2PageData>();
  return data.lines.map((l) => l.text).join("\n");
}

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
  const fromDate = resolveFromDate({
    bodyDate: built.fromDate,
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
