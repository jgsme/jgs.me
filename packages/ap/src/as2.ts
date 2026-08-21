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

// Mastodon では summary が content warning 欄になる。
// 抜粋を入れるとタイムラインが長文で埋まらず、開けば全文が読める。
// WriteFreely が同じ形を採っている。
export function summarize(html: string, maxLength = SUMMARY_MAX): string {
  const text = html
    .replace(/<[^>]*>/g, "")
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
    published: page.created,
    // updated が無いと Mastodon 3.5.0 以降は Update を処理しない。
    // 更新イベントが無い時期でも最初から出しておく必要がある。
    updated: page.updated,
    url: articleURL(page.title),
    attributedTo: ACTOR_URI,
    to: [PUBLIC],
  };
}
