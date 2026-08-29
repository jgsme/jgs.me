import { Hono } from "hono";
import { pages, articles, clips } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { desc, eq } from "drizzle-orm";
import { SITE_URL } from "@/constants/site";
import { fetchBody } from "@/utils/fetchBody";
import { buildArticleBody } from "@/pages/article/@title/articleBody";
import type { Bindings } from "../types";
import { buildRssXml, type RssFeedItem } from "./rssFeed";

const rss = new Hono<{ Bindings: Bindings }>();

const FEED_LIMIT = 20;

// 2 本の feed が同じやり方で item を組む。description の作り方を変えたときに
// 片方だけ直る事故を防ぐため、取得と整形はここに寄せる。
async function toFeedItems(
  r2: Bindings["R2"],
  rows: { title: string; bodyKey: string; created: string }[],
): Promise<RssFeedItem[]> {
  return Promise.all(
    rows.map(async (row) => {
      const body = await fetchBody(r2, row.bodyKey, row.title);
      return {
        title: row.title,
        created: row.created,
        description: body === null ? null : buildArticleBody(body).description,
      };
    }),
  );
}

rss.get("/rss.xml", async (c) => {
  const db = getDB(c.env.DB);

  // 並べるのは page.created。article.created (記事に登録した日) だと、
  // 過去記事をまとめて登録したときにフィードが古い記事で埋まる。
  // トップページ (pages/index/+data.ts) もこの順なので、並びを揃える。
  // innerJoin なのは、page を引けない article で空の item を出さないため。
  const rows = await db
    .select({
      title: pages.title,
      bodyKey: pages.bodyKey,
      created: pages.created,
    })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .orderBy(desc(pages.created))
    .limit(FEED_LIMIT);

  const items = await toFeedItems(c.env.R2, rows);

  const xml = buildRssXml({
    items,
    siteUrl: SITE_URL,
    lastBuildDate: new Date(),
  });

  return c.body(xml, 200, {
    "Content-Type": "application/rss+xml; charset=utf-8",
  });
});

// clip は article より本数が多いので、/rss.xml に混ぜず別 feed にする。
// 並び順とキャッシュの考え方は /rss.xml と同じ。
rss.get("/clips.xml", async (c) => {
  const db = getDB(c.env.DB);

  const rows = await db
    .select({
      title: pages.title,
      bodyKey: pages.bodyKey,
      created: pages.created,
    })
    .from(clips)
    .innerJoin(pages, eq(clips.pageID, pages.id))
    .orderBy(desc(pages.created))
    .limit(FEED_LIMIT);

  const items = await toFeedItems(c.env.R2, rows);

  const xml = buildRssXml({
    items,
    siteUrl: SITE_URL,
    lastBuildDate: new Date(),
    title: "I am Electrical machine - Clips",
    selfPath: "/clips.xml",
  });

  return c.body(xml, 200, {
    "Content-Type": "application/rss+xml; charset=utf-8",
  });
});

export { rss };
