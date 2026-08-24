export type RssFeedItem = {
  title: string;
  // SQLite の CURRENT_TIMESTAMP 由来の "YYYY-MM-DD HH:MM:SS" (UTC)。
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

export function buildRssXml(opts: {
  items: RssFeedItem[];
  siteUrl: string;
  lastBuildDate: Date;
}): string {
  const { items, siteUrl, lastBuildDate } = opts;

  const rssItems = items
    .map((item) => {
      const link = `${siteUrl}/pages/${encodeURIComponent(item.title)}`;
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
    <title>I am Electrical machine</title>
    <link>${siteUrl}/</link>
    <description>Notes from jigsaw</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;
}
