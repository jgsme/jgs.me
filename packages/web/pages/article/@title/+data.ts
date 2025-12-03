import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { parse } from "@progfay/scrapbox-parser";
import { getDB } from "@/db/getDB";
import { articles, pages } from "@jigsaw/db";
import { eq } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { purifyScrapboxText } from "@/utils/purifyScrapboxText";

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { title: string };
};

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

async function fetchPageText(
  r2: R2Bucket,
  sbID: string | null,
  title: string
): Promise<string | null> {
  if (sbID) {
    const obj = await r2.get(`${sbID}.json`);
    if (obj) {
      const data = await obj.json<R2PageData>();
      return data.lines.map((l) => l.text).join("\n");
    }
    console.log(`[R2 miss] title=${title}, sbID=${sbID}`);
  } else {
    console.log(`[R2 skip] title=${title} (no sbID in DB)`);
  }

  const res = await fetch(
    `https://scrapbox.io/api/pages/jigsaw/${encodeURIComponent(title)}/text`
  );
  if (!res.ok) return null;
  return res.text();
}

const data = async (c: Context) => {
  const config = useConfig();
  const title = decodeURIComponent(c.routeParams.title);
  const db = getDB(c.env.DB);

  const pageInfo = await db
    .select({ pageId: pages.id, articleId: articles.id, sbID: pages.sbID })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .where(eq(pages.title, title))
    .limit(1);

  const pageId = pageInfo[0]?.pageId ?? null;
  const sbID = pageInfo[0]?.sbID ?? null;
  const articleId = pageInfo[0]?.articleId ?? null;
  const text = await fetchPageText(c.env.R2, sbID, title);

  if (text === null) {
    config({
      title: `${title} - I am Electrical machine`,
    });
    return {
      ok: false as const,
      title,
      pageId: null,
      articleId: null,
      blocks: [],
      description: null,
    };
  }
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

  let dateLineIndex: number | null = null;
  if (!fromDate) {
    for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 5); i--) {
      const block = blocks[i];
      if (block.type !== "line") continue;
      for (const node of block.nodes) {
        if (node.type === "hashTag") {
          const match = node.href.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            fromDate = `${year}/${month}/${day}`;
            dateLineIndex = i;
            break;
          }
        }
      }
      if (fromDate) break;
    }
  }

  if (!fromDate) {
    const titleDateMatch = title.match(/(\d{4})(\d{2})(\d{2})/);
    if (titleDateMatch) {
      const [, year, month, day] = titleDateMatch;
      fromDate = `${year}/${month}/${day}`;
    }
  }

  let lineCount = 0;
  const filteredBlocks = blocks.filter((block, index) => {
    if (block.type === "title") return false;
    if (block.type === "line" && skipLines > 0) {
      lineCount++;
      if (lineCount <= skipLines) return false;
    }
    if (dateLineIndex !== null && index === dateLineIndex) return false;
    return true;
  });

  const rawDescription = filteredBlocks
    .filter((b) => b.type === "line")
    .map((b) => (b.type === "line" ? b.nodes.map((n) => n.raw).join("") : ""))
    .join("\n");
  const description = purifyScrapboxText(rawDescription).slice(0, 200);

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
  };
};

export default data;
