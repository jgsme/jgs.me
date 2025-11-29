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

  let fromDate: string | null = null;
  let skipLines = 0;

  const firstLineIndex = blocks.findIndex(
    (b) => b.type === "line" && b.nodes.length > 0
  );

  if (firstLineIndex !== -1) {
    const firstLine = blocks[firstLineIndex];
    if (firstLine.type === "line" && firstLine.nodes.length > 0) {
      const firstNode = firstLine.nodes[0];

      if (
        firstNode.type === "plain" &&
        firstNode.text.trim() === "from" &&
        firstLine.nodes.length >= 2
      ) {
        const secondNode = firstLine.nodes[1];
        if (secondNode.type === "link" && secondNode.pathType === "relative") {
          const match = secondNode.href.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            fromDate = `${year}/${month}/${day}`;
            skipLines = 2;
          }
        }
      }
    }
  }

  return {
    ok: true as const,
    title,
    articleId: article[0]?.articleId ?? null,
    blocks,
    fromDate,
    skipLines,
  };
};

export default data;
