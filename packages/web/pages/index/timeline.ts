export type EntryKind = "article" | "zet" | "clip" | "druck";

export type TimelineEntry = {
  kind: EntryKind;
  key: string; // `${kind}:${id}`。zet は `zet:${rkey}`
  day: string; // JST の YYYY-MM-DD
  created: string; // 同じ枠の中を降順に並べるだけに使う
  href: string;
  title: string; // 必ず空でない
  image: string | null;
  excerpt: string | null; // 振り分けには使わない
};

export type TimelineDay = {
  day: string;
  articles: TimelineEntry[]; // 先頭に大きく出す
  tiles: TimelineEntry[]; // 正方形タイル
  texts: TimelineEntry[]; // 文字だけ
};

export const DAYS_PER_PAGE = 10;

const byCreatedDesc = (a: TimelineEntry, b: TimelineEntry) =>
  a.created < b.created ? 1 : a.created > b.created ? -1 : 0;

// 日ごとに article / tile / text の 3 枠へ振り分ける。druck は画像が無くてもタイルにする
export function groupByDay(entries: readonly TimelineEntry[]): TimelineDay[] {
  const map = new Map<string, TimelineDay>();
  for (const e of entries) {
    let d = map.get(e.day);
    if (!d) {
      d = { day: e.day, articles: [], tiles: [], texts: [] };
      map.set(e.day, d);
    }
    if (e.kind === "article") d.articles.push(e);
    else if (e.kind === "druck" || e.image !== null) d.tiles.push(e);
    else d.texts.push(e);
  }
  const days = [...map.values()].sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : 0,
  );
  for (const d of days) {
    d.articles.sort(byCreatedDesc);
    d.tiles.sort(byCreatedDesc);
    d.texts.sort(byCreatedDesc);
  }
  return days;
}

// 最新の日に article が無いときだけ、最新の article を先頭に固定する。
// days が空 (範囲外のページ) なら固定しない
export function pinLatestArticle(
  days: readonly TimelineDay[],
  latest: TimelineEntry | null,
): { pinned: TimelineEntry | null; days: TimelineDay[] } {
  if (!latest || days.length === 0 || days[0].articles.length > 0) {
    return { pinned: null, days: [...days] };
  }
  const out = days
    .map((d) => ({
      ...d,
      articles: d.articles.filter((e) => e.key !== latest.key),
      tiles: d.tiles.filter((e) => e.key !== latest.key),
      texts: d.texts.filter((e) => e.key !== latest.key),
    }))
    .filter((d) => d.articles.length + d.tiles.length + d.texts.length > 0);
  return { pinned: latest, days: out };
}

export function formatDay(day: string, withYear: boolean): string {
  const [y, m, d] = day.split("-");
  return withYear ? `${y}.${m}.${d}` : `${m}.${d}`;
}
