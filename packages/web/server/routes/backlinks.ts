import { Hono } from "hono";
import { getDB } from "@/db/getDB";
import { BACKLINK_PAGE, fetchBacklinks } from "../backlinks";
import type { Backlink } from "../backlinks";
import type { Bindings } from "../types";

const backlinks = new Hono<{ Bindings: Bindings }>();

// 実測の最大被リンク数は 75 件 (2026-09-11)。ここに届く offset は
// 壊れた入力か手打ちのどちらかなので、D1 に走査させない。
const MAX_OFFSET = 1000;

// クエリパラメータは任意の文字列。parseInt だと "24abc" が 24 になる。
// 全体が十進の非負整数のときだけ通す。未指定は 1 ページ目とみなす。
export function parseOffset(raw: string | undefined): number | null {
  if (raw === undefined) return 0;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < MAX_OFFSET ? n : null;
}

// 記事が無い題 (/pages/<題> が Not Found) の「関連ページ」を追加で引く口。
// pageID ではなく題をキーにする。この口が要るのは page 行が無い題であって、
// そこには振る ID が無い。
//
// 題はパスではなくクエリで受ける。題には # ? 空白が入りうるので、
// パスに埋めるとルーティングの段階で壊れる。
backlinks.get("/api/backlinks", async (c) => {
  const title = c.req.query("title");
  if (!title) return c.json({ error: "title is required" }, 400);

  const offset = parseOffset(c.req.query("offset"));
  if (offset === null) return c.json({ error: "invalid offset" }, 400);

  const db = getDB(c.env.DB);
  // limit は受け取らない。外から任意の件数を投げさせない。
  const result = await fetchBacklinks(db, title, offset, BACKLINK_PAGE);

  // 被リンクは投稿のたびに増える。記事ページ本体 (s-maxage=86400) ほど
  // 長くは寝かせられないが、連打で D1 を叩かせる必要も無い。
  c.header("Cache-Control", "s-maxage=300");
  return c.json({
    backlinks: result.backlinks satisfies Backlink[],
    hasMore: result.hasMore,
  });
});

export { backlinks };
