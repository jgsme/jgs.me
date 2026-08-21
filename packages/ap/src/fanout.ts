import { toISO } from "./as2";

// Bridgy Fed が「2週間より古い投稿は橋渡ししない」としているのと同じ理由。
// バックデートされた投稿の扱いは実装ごとに異なり、Mastodon は受信順に表示するため
// 古い日付の記事がタイムラインの想定外の位置に出る。
// Scrapbox アーカイブを Discord ボタンで公開する運用があるため、これが実際に起きる。
export const MAX_AGE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FanoutDecision =
  | { deliver: true }
  | { deliver: false; reason: "too-old" };

export function decideFanout(
  published: string,
  now: Date,
  maxAgeDays: number = MAX_AGE_DAYS,
): FanoutDecision {
  // page.created は D1 の "YYYY-MM-DD HH:MM:SS" (UTC) で来る。
  // そのまま Date に渡すとローカルタイムゾーンで解釈され境界がずれる。
  const t = new Date(toISO(published)).getTime();
  if (Number.isNaN(t)) return { deliver: false, reason: "too-old" };
  const ageMs = now.getTime() - t;
  if (ageMs > maxAgeDays * DAY_MS) return { deliver: false, reason: "too-old" };
  return { deliver: true };
}
