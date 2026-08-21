import { articleURL, objectURI } from "./config";
import { ACTOR_URI } from "./actor";

export const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

const SUMMARY_MAX = 200;

export type PageRow = {
  id: number;
  title: string;
  created: string;
  updated: string;
};

export type AS2Article = {
  "@context": string[];
  id: string;
  type: "Article";
  name: string;
  content: string;
  summary: string;
  published: string;
  updated: string;
  url: string;
  attributedTo: string;
  to: string[];
};

// summary は CW 欄にプレーンテキストとして出るため、
// 本文で escape したぶんを戻す。&amp; を最後に処理しないと
// "&amp;lt;" が "<" まで戻ってしまう。
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// D1 の CURRENT_TIMESTAMP は "YYYY-MM-DD HH:MM:SS" (UTC) を返す。
// AS2 の published / updated は xsd:dateTime なので、そのまま出すと
// 受信側が日時を読めない。読めない値は捏造せずそのまま返す。
export function toISO(value: string): string {
  if (!value) return value;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const t = new Date(normalized);
  if (Number.isNaN(t.getTime())) return value;
  return t.toISOString();
}

// Mastodon では summary が content warning 欄になる。
// 抜粋を入れるとタイムラインが長文で埋まらず、開けば全文が読める。
// WriteFreely が同じ形を採っている。
export function summarize(html: string, maxLength = SUMMARY_MAX): string {
  // タグを空白に置き換える。空文字にすると </p><p> の境目で語が連結する。
  const text = decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function toArticle(page: PageRow, contentHtml: string): AS2Article {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    // id は page.id 由来なので改題しても変わらない。
    // 改題は url と name を差し替えた Update の再配送で伝える。
    id: objectURI(page.id),
    type: "Article",
    name: page.title,
    content: contentHtml,
    summary: summarize(contentHtml),
    published: toISO(page.created),
    // updated が無いと Mastodon 3.5.0 以降は Update を処理しない。
    // 更新イベントが無い時期でも最初から出しておく必要がある。
    updated: toISO(page.updated),
    url: articleURL(page.title),
    attributedTo: ACTOR_URI,
    to: [PUBLIC],
  };
}
