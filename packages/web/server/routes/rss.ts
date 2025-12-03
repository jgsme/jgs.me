import { Hono } from "hono";
import { pages, articles } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { desc, eq } from "drizzle-orm";
import type { Bindings } from "../types";

const rss = new Hono<{ Bindings: Bindings }>();

rss.get("/rss.xml", async (c) => {
  const db = getDB(c.env.DB);

  const items = await db
    .select({
      id: pages.id,
      title: pages.title,
      created: pages.created,
    })
    .from(articles)
    .leftJoin(pages, eq(articles.pageID, pages.id))
    .orderBy(desc(pages.created))
    .limit(20);

  const siteUrl = "https://w.jgs.me";

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const rssItems = items
    .map((item) => {
      const link = `${siteUrl}/pages/${encodeURIComponent(item.title ?? "")}`;
      const pubDate = item.created
        ? new Date(item.created).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>${escapeXml(item.title ?? "")}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>I am Electrical machine</title>
    <link>${siteUrl}/</link>
    <description>Notes from jigsaw</description>
    <language>ja</language>
${rssItems}
  </channel>
</rss>`;

  return c.body(rssContent, 200, {
    "Content-Type": "application/xml",
  });
});

export { rss };
