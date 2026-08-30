// 3D 表示が読む形。この型は buildIndex が決め、+data.ts が re-export する。
// 逆向き (+data.ts で定義して buildIndex が import) にすると循環参照になる。
export type OnThisDayIndex = {
  years: number[];
  entries: {
    [mmdd: string]: [number, number][]; // [yearIndex, count]
  };
};

export type IndexRow = {
  // "0401"
  mmdd: string;
  year: number;
  count: number;
};

// D1 の集計結果を 3D 表示が読む形に畳む。years は昇順で、entries の値は
// [yearIndex, count] の配列。色の割り当てが yearIndex に依存するため、
// years の並び順を変えると見た目が変わる。
export function buildIndex(rows: IndexRow[]): OnThisDayIndex {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const yearMap = new Map(years.map((y, i) => [y, i]));

  const entries: Record<string, [number, number][]> = {};
  for (const row of rows) {
    const yearIndex = yearMap.get(row.year)!;
    const list = entries[row.mmdd];
    if (list) list.push([yearIndex, row.count]);
    else entries[row.mmdd] = [[yearIndex, row.count]];
  }

  for (const list of Object.values(entries)) {
    list.sort((a, b) => a[0] - b[0]);
  }

  return { years, entries };
}
