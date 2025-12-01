import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { articles, pages } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";

type Context = PageContextServer & {
  env: Bindings;
};

const PER_PAGE = 20;

const data = async (c: Context) => {
  const db = getDB(c.env.DB);
  const page = Number(c.urlParsed.search.p) || 1;
  const offset = (page - 1) * PER_PAGE;

  const [as, totalResult] = await Promise.all([
    db
      .select({
        id: pages.id,
        title: pages.title,
        image: pages.image,
      })
      .from(articles)
      .leftJoin(pages, eq(articles.pageID, pages.id))
      .orderBy(desc(pages.created))
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: count() }).from(articles),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      articles: as,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default data;
