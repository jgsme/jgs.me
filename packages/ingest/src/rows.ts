export interface SimilarityRow {
  pageID: number;
  relatedPageID: number;
  score: number;
  adjusted: number;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * リクエストボディを検証して行に変換する。
 * 壊れた行を黙って捨てると「入ったつもりで欠けている」状態になるので、
 * 1 行でも不正なら全体を失敗させる。
 */
export function parseRows(input: unknown): SimilarityRow[] {
  const body = input as { rows?: unknown };
  if (!Array.isArray(body?.rows)) throw new Error("rows must be an array");

  return body.rows.map((r: unknown, i: number) => {
    const row = r as Partial<SimilarityRow>;
    if (!isInt(row.pageID) || !isInt(row.relatedPageID)) {
      throw new Error(`rows[${i}]: pageID / relatedPageID must be integers`);
    }
    if (row.pageID === row.relatedPageID) {
      throw new Error(`rows[${i}]: self reference`);
    }
    if (!isNum(row.score) || !isNum(row.adjusted)) {
      throw new Error(`rows[${i}]: score / adjusted must be finite numbers`);
    }
    return {
      pageID: row.pageID,
      relatedPageID: row.relatedPageID,
      score: row.score,
      adjusted: row.adjusted,
    };
  });
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
