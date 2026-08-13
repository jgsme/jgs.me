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

function presenceCount(row: Row, table: TargetTable): number {
  const column = PRESENCE_COLUMN[table];
  const count = Number(row[column]);
  if (Number.isNaN(count)) {
    throw new Error(`行から ${column} を読めなかった: ${raw(row)}`);
  }
  return count;
}

/** filter は全要素を評価するので、3 列すべてが検証される */
function registeredTables(row: Row): TargetTable[] {
  return TARGET_TABLES.filter((table) => presenceCount(row, table) > 0);
}

/** どの ID もどのテーブルにも入っていなければ false (DELETE を起動する必要がない) */
export function hasRegistrations(rows: Row[]): boolean {
  // 形状が違えば DELETE を撃つ前にここで落とす
  for (const row of rows) {
    rowId(row);
  }
  return rows.some((row) => registeredTables(row).length > 0);
}

/**
 * ID ごとの報告行を引数順で組み立てる。
 * 同じ ID を 2 回渡されても 1 行にまとめる (行と changes の突き合わせが狂うため)。
 * 形状が違う行は `hasRegistrations` より前に来ても落ちるよう、ここでも検証する。
 */
function describe(
  ids: number[],
  rows: Row[],
): { lines: string[]; expected: number } {
  const byId = new Map<number, Row>();
  for (const row of rows) {
    byId.set(rowId(row), row);
  }

  let expected = 0;
  const lines = [...new Set(ids)].map((id) => {
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

  return { lines, expected };
}

/** DELETE が途中で失敗したとき用。合計行・警告行は出さない (changes が不完全なため) */
export function formatPartialResult(ids: number[], rows: Row[]): string {
  return describe(ids, rows).lines.join("\n");
}

export function formatResult(
  ids: number[],
  rows: Row[],
  changesByTable: Record<TargetTable, number>,
): string {
  const { lines, expected } = describe(ids, rows);

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
