import { and, eq, gte, lt, or, type SQL } from "drizzle-orm";
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

// base と "base (…" を 1 回で引く条件。候補を 1 件ずつ SELECT で試すと
// 衝突のたびに D1 への往復が増えるので、採番はメモリ上で決める。
//
// 前方一致に LIKE は使えない。D1 は SQLITE_MAX_LIKE_PATTERN_LENGTH を 50 に
// 絞っていて、これを超えるパターンは "LIKE or GLOB pattern too complex" で
// SQLITE_ERROR になる。UTF-8 の日本語は 1 文字 3 バイトなので、題が 15 文字
// ほどで `base (%)` が上限を超えて SELECT ごと落ちる。
//
// 代わりに BINARY collation (text のデフォルト) の範囲比較で引く。'(' の
// 次のコードポイントは ')' なので、[base + " (", base + " )") がちょうど
// 「base + " (" で始まる題」の範囲になる。範囲比較に長さ制限は無く、
// title の unique index もそのまま効く。
//
// この範囲は "base (1)" だけでなく "base (メモ)" のような無関係な題も拾うが、
// 拾った題が集合に増えるだけなので採番は安全側 (別の番号) に倒れる。
export function titleFilter(base: string): SQL | undefined {
  return or(
    eq(pages.title, base),
    and(gte(pages.title, `${base} (`), lt(pages.title, `${base} )`)),
  );
}

export async function uniqueTitle(db: DB, base: string): Promise<string> {
  const rows = await db
    .select({ title: pages.title })
    .from(pages)
    .where(titleFilter(base));

  return pickUniqueTitle(base, new Set(rows.map((r) => r.title)));
}
