import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { parse } from "@progfay/scrapbox-parser";
import { getDB } from "@/db/getDB";
import { articles, pageSimilarities, pages, reactions } from "@jigsaw/db";
import { isMicropubBodyKey, r2KeyOf } from "@jigsaw/db/body-key";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { purifyScrapboxText } from "@/utils/purifyScrapboxText";
import { pickRandom } from "@/utils/pickRandom";
import { routeTitleToPageTitle } from "@/utils/routeTitle";

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

type Body = { kind: "scrapbox"; text: string } | { kind: "html"; html: string };

async function fetchBody(
  r2: R2Bucket,
  bodyKey: string,
  title: string,
): Promise<Body | null> {
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

  if (isMicropubBodyKey(bodyKey)) {
    // Micropub 投入時にサニタイズ済み (計画2 Task 2)。表示時は再サニタイズしない。
    return { kind: "html", html: await obj.text() };
  }

  const data = await obj.json<R2PageData>();
  return {
    kind: "scrapbox",
    text: data.lines.map((l) => l.text).join("\n"),
  };
}

// description 用。本文そのものではないのでタグを落とすだけで足りる。
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .where(eq(pages.title, title))
    .limit(1);

  const pageId = pageInfo[0]?.pageId ?? null;
  const bodyKey = pageInfo[0]?.bodyKey ?? "";
  const articleId = pageInfo[0]?.articleId ?? null;

  // 関連記事。article でないページには出さない。
  let related: { title: string }[] = [];
  if (pageId !== null && articleId !== null) {
    const candidates = await db
      .select({ title: pages.title })
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

  // 反応。ActivityPub 経由 (計画5) と Webmention 経由 (計画6) が同じ行に入る。
  // 取り消されたもの (undone) は出さない。
  const reactionRows =
    pageId !== null
      ? await db
          .select({
            id: reactions.id,
            kind: reactions.kind,
            emoji: reactions.emoji,
            actorName: reactions.actorName,
            actorURL: reactions.actorURL,
            actorIcon: reactions.actorIcon,
            content: reactions.content,
            created: reactions.created,
          })
          .from(reactions)
          .where(
            and(
              eq(reactions.targetPageID, pageId),
              eq(reactions.undone, false),
            ),
          )
          .orderBy(desc(reactions.created))
      : [];

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
      bodyHtml: null,
      description: null,
      related: [],
      reactions: [],
    };
  }

  // Scrapbox 記法だけがパーサを通る。HTML はそのまま渡す。
  const bodyHtml = body.kind === "html" ? body.html : null;

  let fromDate: string | null = null;
  let filteredBlocks: ReturnType<typeof parse> = [];
  let description = "";

  if (body.kind === "scrapbox") {
    const blocks = parse(body.text);
    let skipLines = 0;

    const firstLineIndex = blocks.findIndex(
      (b) => b.type === "line" && b.nodes.length > 0,
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
          if (
            secondNode.type === "link" &&
            secondNode.pathType === "relative"
          ) {
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
      for (
        let i = blocks.length - 1;
        i >= Math.max(0, blocks.length - 5);
        i--
      ) {
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

    let lineCount = 0;
    filteredBlocks = blocks.filter((block, index) => {
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
    description = purifyScrapboxText(rawDescription).slice(0, 200);
  } else {
    description = stripTags(body.html).slice(0, 200);
  }

  if (!fromDate) {
    const titleDateMatch = title.match(/(\d{4})(\d{2})(\d{2})/);
    if (titleDateMatch) {
      const [, year, month, day] = titleDateMatch;
      fromDate = `${year}/${month}/${day}`;
    }
  }

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
    bodyHtml,
    fromDate,
    description,
    related,
    reactions: reactionRows,
  };
};

export default data;
