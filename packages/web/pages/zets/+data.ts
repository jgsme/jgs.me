import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { pages, zets } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";
import { toZetListItem } from "./zetView";

type Context = PageContextServer & {
  env: Bindings;
};

const PER_PAGE = 20;

const data = async (c: Context) => {
  const db = getDB(c.env.DB);
  const page = Number(c.urlParsed.search.p) || 1;
  const offset = (page - 1) * PER_PAGE;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        rkey: zets.rkey,
        title: zets.title,
        date: zets.date,
        image: pages.image,
      })
      .from(zets)
      // page を引けない zet があっても壊れたリンクを出さない (/clips と同じ)。
      .innerJoin(pages, eq(zets.pageID, pages.id))
      // date 降順 (spec)。同じ日の中では新しく書いたものを上に。
      .orderBy(desc(zets.date), desc(pages.created))
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: count() }).from(zets),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      zets: rows.map(toZetListItem),
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default data;
