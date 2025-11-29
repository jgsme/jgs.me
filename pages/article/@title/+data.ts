import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { parse } from "@progfay/scrapbox-parser";
import { getDB } from "@/db/getDB";
import { articles, pages } from "@/db/schema";
import { eq } from "drizzle-orm";

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { title: string };
};

const data = async (c: Context) => {
  const title = decodeURIComponent(c.routeParams.title);
  const db = getDB(c.env.DB);

  // article ID を取得
  const article = await db
    .select({ articleId: articles.id })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .where(eq(pages.title, title))
    .limit(1);

  const res = await fetch(
    `https://scrapbox.io/api/pages/jigsaw/${encodeURIComponent(title)}/text`
  );

  if (!res.ok) {
    return {
      ok: false as const,
      title,
      articleId: null,
      blocks: [],
    };
  }

  const text = await res.text();
  const blocks = parse(text);

  return {
    ok: true as const,
    title,
    articleId: article[0]?.articleId ?? null,
    blocks,
  };
};

export default data;
