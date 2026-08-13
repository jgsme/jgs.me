export const TARGET_TABLES = ["article", "clip", "excluded_page"] as const;

export function buildSql(ids: number[]): string {
  if (ids.length === 0) {
    throw new Error("buildSql requires at least one id");
  }
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`buildSql got a non-positive-integer id: ${id}`);
    }
  }

  const list = ids.join(", ");
  const statements = [
    `SELECT id, title FROM page WHERE id IN (${list})`,
    ...TARGET_TABLES.map(
      (table) => `SELECT pageID FROM ${table} WHERE pageID IN (${list})`,
    ),
    ...TARGET_TABLES.map(
      (table) => `DELETE FROM ${table} WHERE pageID IN (${list})`,
    ),
  ];

  return statements.map((s) => `${s};`).join("\n") + "\n";
}
