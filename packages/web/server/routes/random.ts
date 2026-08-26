import { Hono } from "hono";
import { pages, articles } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { eq, sql } from "drizzle-orm";
import type { Bindings } from "../types";

const random = new Hono<{ Bindings: Bindings }>();

random.get("/random", async (c) => {
  const db = getDB(c.env.DB);

  // 選ぶのは SQL 側。全件を引いてから JS で選ぶと記事が増えるほど重くなる。
  // innerJoin なのは、page を引けない article に当たって空振りさせないため。
  const result = await db
    .select({ title: pages.title })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .orderBy(sql`random()`)
    .limit(1);

  // エッジや中間 CDN に焼かれると以降ずっと同じ記事が返る。
  // server/index.ts の cache middleware は /random を通していないが、
  // それとは別に自分でも明示しておく。
  c.header("Cache-Control", "no-store");

  if (result.length === 0) {
    return c.redirect("/");
  }

  return c.redirect(`/pages/${encodeURIComponent(result[0].title)}`);
});

export { random };
