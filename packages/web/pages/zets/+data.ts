import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { pages, zets } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { buildArticleBody } from "@/pages/article/@title/articleBody";
import { toZetTimeline } from "./zetView";

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
        pageTitle: pages.title,
        bodyKey: pages.bodyKey,
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

  // 抜粋は読む時に本文から作る (/rss.xml と同じやり方。R2 の get は 1 ページ最大 20 回)。
  // ingest で D1 に持たせると、作り方を変えるたびに全件 backfill になる。
  const withExcerpt = await Promise.all(
    rows.map(async ({ pageTitle, bodyKey, ...row }) => {
      const body = await fetchBody(c.env.R2, bodyKey, pageTitle);
      return {
        ...row,
        excerpt: body === null ? null : buildArticleBody(body).description,
      };
    }),
  );

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      zets: toZetTimeline(withExcerpt),
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default data;
