import type { PageContextServer } from "vike/types";
import { Bindings } from "@/hono-entry";
import { articles, pages } from "@/db/schema";
import { getDB } from "@/db/getDB";
import { desc, eq } from "drizzle-orm";

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context) => {
  const db = getDB(c.env.DB);
  const as = await db
    .select({
      id: pages.id,
      title: pages.title,
      image: pages.image,
    })
    .from(articles)
    .leftJoin(pages, eq(articles.pageID, pages.id))
    .orderBy(desc(pages.created))
    .limit(10);
  return {
    ok: true,
    payload: {
      articles: as,
    },
  };
};

export default data;
