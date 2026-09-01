import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { reactions as reactionTable } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import type { Bindings } from "../types";

const reactions = new Hono<{ Bindings: Bindings }>();

export type ReactionJSON = {
  id: string;
  kind: string;
  emoji: string | null;
  actorName: string | null;
  actorURL: string | null;
  actorIcon: string | null;
  content: string | null;
  // 反応元ページ。Webmention 受信のときだけ入る (ActivityPub 側は null)。
  sourceURL: string | null;
  sourceTitle: string | null;
  sourceImage: string | null;
  created: string;
};

// ルートパラメータは任意の文字列。parseInt だと "12abc" が 12 になり、
// 別ページの反応を引ける。全体が十進整数のときだけ通す。
export function parsePageID(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

// 記事ページ (/pages/*) は s-maxage=86400 でエッジに載る。反応を SSR に含めると
// キャッシュが切れるまで増えないので、ここから CSR で引く (pages/article/@title)。
reactions.get("/api/reactions/:pageID", async (c) => {
  const pageID = parsePageID(c.req.param("pageID"));
  if (pageID === null) return c.json({ error: "invalid pageID" }, 400);

  const db = getDB(c.env.DB);
  const rows = await db
    .select({
      id: reactionTable.id,
      kind: reactionTable.kind,
      emoji: reactionTable.emoji,
      actorName: reactionTable.actorName,
      actorURL: reactionTable.actorURL,
      actorIcon: reactionTable.actorIcon,
      content: reactionTable.content,
      sourceURL: reactionTable.sourceURL,
      sourceTitle: reactionTable.sourceTitle,
      sourceImage: reactionTable.sourceImage,
      created: reactionTable.created,
    })
    .from(reactionTable)
    // 取り消されたもの (undone) は出さない。
    .where(
      and(
        eq(reactionTable.targetPageID, pageID),
        eq(reactionTable.undone, false),
      ),
    )
    .orderBy(desc(reactionTable.created));

  // 反応の反映が最大 1 分遅れる代わりに、記事に貼られた分の D1 を叩かせない。
  c.header("Cache-Control", "s-maxage=60");
  return c.json({ reactions: rows satisfies ReactionJSON[] });
});

export { reactions };
