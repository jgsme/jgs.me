import { bodyFormatOf } from "@jigsaw/db/body-key";
import { htmlArticleDescription } from "@/utils/htmlArticle";
import { articlePath, druckPath } from "@/utils/permalink";
import { buildArticleBody } from "@/pages/article/@title/articleBody";

// 本文の形式で抜粋の作り方が違う。html 記事の派生テキストは Scrapbox 記法
// ではないので、Scrapbox として組むと [..] や # が消える。
export const rssDescription = (bodyKey: string, body: string): string =>
  bodyFormatOf(bodyKey) === "standard-html"
    ? htmlArticleDescription(body)
    : buildArticleBody(body).description;

type FeedRow = {
  id: number;
  title: string;
  bodyKey: string;
  created: string;
  spoiler: boolean;
};

// article と druck は表ごとに id を採番するので、link は行ごとに決める。
// 並べるのは page.created (article.created だと過去記事の一括登録で古い
// 記事がフィードを埋める)。表ごとに limit 件ずつ引いた上で混ぜれば、
// 混ぜたあとの先頭 limit 件はどちらの表でも取りこぼさない。
export const mergeArticleAndDruck = (
  articleRows: FeedRow[],
  druckRows: FeedRow[],
  limit: number,
): (FeedRow & { linkPath: string })[] =>
  [
    ...articleRows.map((row) => ({ ...row, linkPath: articlePath(row.id) })),
    ...druckRows.map((row) => ({ ...row, linkPath: druckPath(row.id) })),
  ]
    // article は "YYYY-MM-DD HH:MM:SS"、druck は UTC ISO と書式が違うので、
    // 文字列ではなく時刻の数値で比べる。読めない値は一番古い扱い。
    // 同時刻は article を先に (sort は安定)。
    .sort((a, b) => createdTime(b.created) - createdTime(a.created))
    .slice(0, limit);

const createdTime = (created: string): number =>
  parseCreated(created)?.getTime() ?? Number.NEGATIVE_INFINITY;

export type RssFeedItem = {
  title: string;
  // item の permalink パス (/a/:id, /c/:id, /d/:id)。title から組むと改題で link が
  // 変わり、reader 側で同じ item が二度出る。utils/permalink.ts 参照。
  linkPath: string;
  // UTC。"YYYY-MM-DD HH:MM:SS" (SQLite の CURRENT_TIMESTAMP 由来) か
  // ISO 8601 (druck の page.created)。
  created: string;
  description: string | null;
};

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// "2026-08-24 01:21:57" は Date に渡すと実行環境の TZ で解釈される。
// DB に入っているのは UTC なので、そのまま渡すと TZ のぶんずれる。
const parseCreated = (created: string): Date | null => {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(created)
    ? `${created.replace(" ", "T")}Z`
    : created;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DEFAULT_TITLE = "I am Electrical machine";
const DEFAULT_SELF_PATH = "/rss.xml";

export function buildRssXml(opts: {
  items: RssFeedItem[];
  siteUrl: string;
  lastBuildDate: Date;
  // feed が 2 本になったので、reader が見分けられるよう題を分けられる
  // ようにする。省略時は既存の /rss.xml と同じ値。
  title?: string;
  selfPath?: string;
}): string {
  const {
    items,
    siteUrl,
    lastBuildDate,
    title = DEFAULT_TITLE,
    selfPath = DEFAULT_SELF_PATH,
  } = opts;

  const rssItems = items
    .map((item) => {
      const link = `${siteUrl}${item.linkPath}`;
      const created = parseCreated(item.created);
      const pubDate = (created ?? lastBuildDate).toUTCString();
      const description = item.description
        ? `\n      <description>${escapeXml(item.description)}</description>`
        : "";
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>${description}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}/</link>
    <description>Notes from jigsaw</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}${selfPath}" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;
}
