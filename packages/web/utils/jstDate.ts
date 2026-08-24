// ISO8601 (UTC) の日時文字列を JST の日付 "YYYY/MM/DD" に直す。
// 記事の日付表示は既存の fromDate に揃えて日付だけを出すため、時刻は捨てる。
// 読めない値は null を返し、呼び出し側で日付ごと出さない。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;

  // +9h してから UTC の年月日を読むと JST の暦日になる。
  const d = new Date(t + JST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
