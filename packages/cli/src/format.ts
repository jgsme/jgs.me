import { PRESENCE_COLUMN, TARGET_TABLES, type TargetTable } from "./sql.ts";

type Row = Record<string, unknown>;

function raw(value: unknown): string {
  return String(JSON.stringify(value)).slice(0, 500);
}

function firstEntry(output: unknown): Row {
  if (!Array.isArray(output)) {
    throw new Error(`wrangler の出力が配列でない: ${raw(output)}`);
  }
  const entry = output[0];
  if (entry === null || typeof entry !== "object") {
    throw new Error(`wrangler の出力に結果がない: ${raw(output)}`);
  }
  return entry as Row;
}

export function parseRows(output: unknown): Row[] {
  const results = firstEntry(output).results;
  if (!Array.isArray(results)) {
    throw new Error(`wrangler の出力に results がない: ${raw(output)}`);
  }
  return results as Row[];
}

export function parseChanges(output: unknown): number {
  const meta = firstEntry(output).meta;
  if (meta === null || typeof meta !== "object") {
    throw new Error(`wrangler の出力に meta がない: ${raw(output)}`);
  }
  const changes = (meta as Row).changes;
  if (typeof changes !== "number") {
    throw new Error(
      `wrangler の出力の meta.changes が数値でない: ${raw(output)}`,
    );
  }
  return changes;
}

function rowId(row: Row): number {
  const id = Number(row.id);
  if (Number.isNaN(id)) {
    throw new Error(`行から id を読めなかった: ${raw(row)}`);
  }
  return id;
}

function registeredTables(row: Row): TargetTable[] {
  return TARGET_TABLES.filter(
    (table) => Number(row[PRESENCE_COLUMN[table]]) > 0,
  );
}

/** どの ID もどのテーブルにも入っていなければ false (DELETE を起動する必要がない) */
export function hasRegistrations(rows: Row[]): boolean {
  // 形状が違えば DELETE を撃つ前にここで落とす
  for (const row of rows) {
    rowId(row);
  }
  return rows.some((row) => registeredTables(row).length > 0);
}

export function formatResult(
  ids: number[],
  rows: Row[],
  changesByTable: Record<TargetTable, number>,
): string {
  const byId = new Map<number, Row>();
  for (const row of rows) {
    byId.set(rowId(row), row);
  }

  let expected = 0;
  const lines = ids.map((id) => {
    const row = byId.get(id);
    if (row === undefined) {
      return `${id}: page が存在しない`;
    }
    const title = String(row.title);
    const deleted = registeredTables(row);
    expected += deleted.length;
    if (deleted.length === 0) {
      return `${id} 「${title}」: もともと未登録`;
    }
    return `${id} 「${title}」: ${deleted.join(", ")} を削除`;
  });

  const actual = TARGET_TABLES.reduce(
    (sum, table) => sum + changesByTable[table],
    0,
  );

  if (expected !== actual) {
    lines.push(
      `→ 警告: ${expected} 行削除される見込みだったが、実際には ${actual} 行削除された`,
    );
  } else if (expected > 0) {
    lines.push(`→ 計 ${expected} 行削除`);
  }

  return lines.join("\n");
}
