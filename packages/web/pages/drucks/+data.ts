import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { druck, pages } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";
import { druckPageLinks, toDruckList } from "./druckView";

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
        id: druck.id,
        title: pages.title,
        image: pages.image,
      })
      .from(druck)
      // page を引けない druck があっても壊れたリンクを出さない (/clips と同じ)。
      .innerJoin(pages, eq(druck.pageID, pages.id))
      // date 降順。同じ日の中では新しく書いたものを上に。
      .orderBy(desc(druck.date), desc(pages.created))
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: count() }).from(druck),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      druck: toDruckList(rows),
      links: druckPageLinks(page, page < totalPages),
    },
  };
};

export default data;
