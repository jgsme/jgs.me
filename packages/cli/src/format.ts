import { TARGET_TABLES } from "./sql.ts";

const STATEMENT_COUNT = 1 + TARGET_TABLES.length * 2;

type D1Result = { results?: unknown[] };

function unwrap(output: unknown): D1Result[] {
  if (Array.isArray(output)) {
    return output as D1Result[];
  }
  if (output !== null && typeof output === "object") {
    for (const value of Object.values(output)) {
      if (Array.isArray(value)) {
        return value as D1Result[];
      }
    }
  }
  throw new Error(
    `unexpected wrangler output: ${JSON.stringify(output).slice(0, 500)}`,
  );
}

function rowsOf(entry: D1Result | undefined): Record<string, unknown>[] {
  const results = entry?.results;
  if (!Array.isArray(results)) {
    throw new Error(
      `unexpected wrangler output: missing results: ${JSON.stringify(entry).slice(0, 500)}`,
    );
  }
  return results as Record<string, unknown>[];
}

export function formatResult(ids: number[], output: unknown): string {
  const entries = unwrap(output);
  if (entries.length < STATEMENT_COUNT) {
    throw new Error(
      `expected ${STATEMENT_COUNT} statement results, got ${entries.length}: ${JSON.stringify(entries).slice(0, 500)}`,
    );
  }

  const titles = new Map<number, string>();
  for (const row of rowsOf(entries[0])) {
    titles.set(Number(row.id), String(row.title));
  }

  const hits = TARGET_TABLES.map((_, i) => {
    const set = new Set<number>();
    for (const row of rowsOf(entries[1 + i])) {
      set.add(Number(row.pageID));
    }
    return set;
  });

  return ids
    .map((id) => {
      const title = titles.get(id);
      if (title === undefined) {
        return `${id}: page が存在しない`;
      }
      const deleted = TARGET_TABLES.filter((_, i) => hits[i].has(id));
      if (deleted.length === 0) {
        return `${id} 「${title}」: もともと未登録`;
      }
      return `${id} 「${title}」: ${deleted.join(", ")} を削除`;
    })
    .join("\n");
}
