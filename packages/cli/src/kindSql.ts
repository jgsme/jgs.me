import type { ClipKind } from "./kindArgs.ts";

/**
 * kind ごとにまとめて UPDATE を組む。
 *
 * 1 件ずつ UPDATE すると wrangler を件数ぶん起動することになる (1665 件で
 * 1665 回)。kind は 4 種類しかないので、まとめれば最大 4 文で済む。
 *
 * kind は CLIP_KINDS で検証済みの値しか来ないので、SQL に直接埋めても
 * 注入にならない。id は正の整数であることをここで確かめる。
 */
export function buildKindUpdateSql(
  rows: { id: number; kind: ClipKind }[],
): string {
  if (rows.length === 0) {
    throw new Error("SQL の組み立てには 1 行以上が必要");
  }
  const byKind = new Map<ClipKind, number[]>();
  for (const { id, kind } of rows) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`正の整数でない pageID: ${id}`);
    }
    const list = byKind.get(kind);
    if (list) list.push(id);
    else byKind.set(kind, [id]);
  }
  return [...byKind]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([kind, ids]) =>
        `UPDATE clip SET kind = '${kind}' WHERE pageID IN (${ids.join(", ")});`,
    )
    .join("\n");
}
