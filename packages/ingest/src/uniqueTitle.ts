import { eq, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { pages } from "@jigsaw/db";

type DB = DrizzleD1Database<Record<string, never>>;

// 題が既に使われていたら " (1)" から順に空き番号を探す。
// 最大値 +1 ではなく空きを埋めるのは、消した番号を再利用して番号が
// 無駄に伸びないようにするため。existing は有限なのでループは必ず終わる。
export function pickUniqueTitle(
  base: string,
  existing: ReadonlySet<string>,
): string {
  if (!existing.has(base)) return base;
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})`;
    if (!existing.has(candidate)) return candidate;
  }
}

// 候補を 1 件ずつ SELECT で試すと衝突のたびに D1 への往復が増える。
// base と "base (%)" を 1 回で引いて、採番はメモリ上で決める。
// base に % や _ が入ると LIKE が余分な行を拾うが、拾った題が集合に
// 増えるだけなので採番は安全側 (別の番号)に倒れる。
export async function uniqueTitle(db: DB, base: string): Promise<string> {
  const rows = await db
    .select({ title: pages.title })
    .from(pages)
    .where(or(eq(pages.title, base), like(pages.title, `${base} (%)`)));

  return pickUniqueTitle(base, new Set(rows.map((r) => r.title)));
}
