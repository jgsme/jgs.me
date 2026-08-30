import { bodyFormatOf } from "./bodyKey";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 末尾の #YYYYMMDD を探す範囲。記事末尾の日付タグを拾うためのもので、
// 本文中で言及しただけの日付を拾わないように狭く取る。
const TAIL_LINES = 5;

function isValidMonthDay(month: string, day: string): boolean {
  const m = Number(month);
  const d = Number(day);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// 本文から完全な日付 (YYYYMMDD) を取る。
// 1行目の `from [YYYYMMDD]` を最優先し、無ければ末尾 5 行の `#YYYYMMDD` を見る。
export function extractBodyDate(body: string): string | null {
  const lines = body.split("\n");

  // 0行目は題なので必ず飛ばす。そこから最初の非空行 (空白のみの行も空扱い) を
  // from 行の候補として見る。
  let fromLineIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== "") {
      fromLineIndex = i;
      break;
    }
  }
  const fromMatch =
    fromLineIndex === -1
      ? null
      : lines[fromLineIndex]?.match(/^from \[(\d{4})(\d{2})(\d{2})\]/);
  if (fromMatch) {
    const [, year, month, day] = fromMatch;
    if (isValidMonthDay(month, day)) return `${year}-${month}-${day}`;
  }

  // 末尾には作成日と更新日が並記されていることがある (`#20190527 ... C` /
  // `#20190605 ... U`)。旧ブログからの移行記事も「元記事の日付」と「移行日」を
  // 並べて持つ。記事が書かれた日は常に古い方なので、範囲内の候補を全部集めて
  // 最も古いものを採る。下から探して最初に当たったものを返すと更新日を拾う。
  const tail = lines.slice(Math.max(0, lines.length - TAIL_LINES));
  const candidates: string[] = [];
  for (const line of tail) {
    for (const m of line.matchAll(/#(\d{4})(\d{2})(\d{2})(?!\d)/g)) {
      const [, year, month, day] = m;
      if (isValidMonthDay(month, day)) candidates.push(`${year}-${month}-${day}`);
    }
  }
  if (candidates.length > 0) return candidates.sort()[0];

  return null;
}

// 本文から月日だけのタグ (#MMDD) を取る。旧ブログからの移行記事が持つ形式。
// #YYYYMMDD の一部を拾わないよう、前後に数字が続かないものだけを見る。
export function extractBodyMonthDay(body: string): string | null {
  const matches = body.matchAll(/(?<!\d)#(\d{2})(\d{2})(?!\d)/g);
  for (const m of matches) {
    const [, month, day] = m;
    if (isValidMonthDay(month, day)) return `${month}-${day}`;
  }
  return null;
}

// ISO8601 (UTC) の日時文字列を JST の暦日 "YYYY-MM-DD" に直す。
// 読めない値は null を返す。
export function jstDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;

  // +9h してから UTC の年月日を読むと JST の暦日になる。
  const d = new Date(t + JST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type ResolveInput = {
  // Scrapbox 記法の本文 (1行目が題)。取得できなければ null。
  body: string | null;
  title: string;
  bodyKey: string;
  created: string;
};

// 記事が書かれた日を決める。優先順位は spec の「日付解決の規則」に従う。
export function resolveArticleDate({
  body,
  title,
  bodyKey,
  created,
}: ResolveInput): string | null {
  // 規則1, 2
  if (body) {
    const bodyDate = extractBodyDate(body);
    if (bodyDate) return bodyDate;
  }

  // 規則3
  const titleMatch = title.match(/(\d{4})(\d{2})(\d{2})/);
  if (titleMatch) {
    const [, year, month, day] = titleMatch;
    if (isValidMonthDay(month, day)) return `${year}-${month}-${day}`;
  }

  // 規則4: 月日は本文から、年だけ created から取る。
  // created の日付そのものは信用できないが、年は一致することを確認済み。
  if (body) {
    const monthDay = extractBodyMonthDay(body);
    if (monthDay) {
      const createdDate = jstDate(created);
      if (createdDate) return `${createdDate.slice(0, 4)}-${monthDay}`;
    }
  }

  // 規則5: Scrapbox アーカイブ由来の created はインポート時刻なので使わない。
  if (bodyFormatOf(bodyKey) === "micropub-sb") return jstDate(created);

  // 規則6
  return null;
}
