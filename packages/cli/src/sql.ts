export const TARGET_TABLES = ["article", "clip", "excluded_page"] as const;
export type TargetTable = (typeof TARGET_TABLES)[number];

/** 集約 SELECT が返す、テーブルごとの在籍数の列名 */
export const PRESENCE_COLUMN: Record<TargetTable, string> = {
  article: "in_article",
  clip: "in_clip",
  excluded_page: "in_excluded",
};

function idList(ids: number[]): string {
  if (ids.length === 0) {
    throw new Error("SQL の組み立てには 1 つ以上の id が必要");
  }
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`正の整数でない id: ${id}`);
    }
  }
  return ids.join(", ");
}

export function buildSelectSql(ids: number[]): string {
  const list = idList(ids);
  const counts = TARGET_TABLES.map(
    (table) =>
      `  (SELECT COUNT(*) FROM ${table} WHERE pageID = p.id) AS ${PRESENCE_COLUMN[table]}`,
  ).join(",\n");
  return `SELECT p.id, p.title,\n${counts}\nFROM page p WHERE p.id IN (${list})`;
}

export function buildDeleteSql(table: TargetTable, ids: number[]): string {
  const list = idList(ids);
  return `DELETE FROM ${table} WHERE pageID IN (${list})`;
}
