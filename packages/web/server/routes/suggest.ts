import { Hono } from "hono";
import * as schema from "@jigsaw/db";
import { excludedPages, pages } from "@jigsaw/db";
import { and, eq, like, notExists, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { getDB } from "@/db/getDB";
import type { Bindings } from "../types";

// D1 でもテスト用の in-memory SQLite でも同じクエリを走らせたいので、
// ドライバを固定しない型で受ける。
export type SuggestDB = BaseSQLiteDatabase<"async", unknown, typeof schema>;

// サジェストに出す件数。多くしても候補の下のほうは読まれない。
export const SUGGEST_LIMIT = 8;

// LIKE のワイルドカードを潰す。ESCAPE '\' と対で使う。
// バックスラッシュを先に置換しないと、後から足したエスケープ文字を
// さらに escape してしまい "\%" が "\" + ワイルドカードに戻る。
export const escapeLikePattern = (q: string): string =>
  q.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");

export const suggestTitles = async (
  db: SuggestDB,
  q: string,
  limit: number = SUGGEST_LIMIT,
): Promise<string[]> => {
  const trimmed = q.trim();
  // LIKE '%%' は全件に当たる。DB を引く前に返す。
  if (trimmed === "") return [];

  const escaped = escapeLikePattern(trimmed);

  const rows = await db
    .select({ title: pages.title })
    .from(pages)
    .where(
      and(
        like(pages.title, sql`${`%${escaped}%`} escape '\\'`),
        // excluded_page は「見せない」意図の枠なので、サジェストにも出さない。
        notExists(
          db
            .select({ one: sql`1` })
            .from(excludedPages)
            .where(eq(excludedPages.pageID, pages.id)),
        ),
      ),
    )
    // 前方一致を先に、同着は短い題を先に。短い題ほど概念そのものに近い。
    .orderBy(
      sql`case when ${pages.title} like ${`${escaped}%`} escape '\\' then 0 else 1 end`,
      sql`length(${pages.title})`,
    )
    .limit(limit);

  return rows.map((row) => row.title);
};

const suggest = new Hono<{ Bindings: Bindings }>();

suggest.get("/api/search/suggest", async (c) => {
  const q = c.req.query("q") ?? "";
  const titles = await suggestTitles(getDB(c.env.DB), q);

  return c.json({ titles });
});

export { suggest };
