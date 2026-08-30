export type DayArticle = {
  title: string;
  image: string | null;
  // "YYYY-MM-DD"
  date: string;
};

export type YearGroup = {
  year: number;
  articles: DayArticle[];
};

// 年ごとにまとめて新しい年から並べる。年内の順序は入力のまま保つ。
export function groupByYear(rows: DayArticle[]): YearGroup[] {
  const buckets = new Map<number, DayArticle[]>();

  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    const bucket = buckets.get(year);
    if (bucket) bucket.push(row);
    else buckets.set(year, [row]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, articles]) => ({ year, articles }));
}
