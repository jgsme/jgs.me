import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { articles, clips, pages, zets } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";

type Context = PageContextServer & {
  env: Bindings;
};

const PER_PAGE = 20;
// index に差し込む clip の数。多すぎると記事の一覧が分断される。
const RECENT_CLIPS = 6;
const RECENT_ZETS = 6;

const data = async (c: Context) => {
  const db = getDB(c.env.DB);
  const page = Number(c.urlParsed.search.p) || 1;
  const offset = (page - 1) * PER_PAGE;

  const [as, totalResult, recentClips, recentZets] = await Promise.all([
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
    // clip は 1 ページ目にだけ差し込む。2 ページ目以降は過去記事を
    // 遡っている最中なので、そこに最新の clip が出ると文脈が切れる。
    page === 1
      ? db
          .select({
            id: clips.id,
            title: pages.title,
            image: pages.image,
          })
          .from(clips)
          .innerJoin(pages, eq(clips.pageID, pages.id))
          .orderBy(desc(pages.created))
          .limit(RECENT_CLIPS)
      : Promise.resolve([]),
    page === 1
      ? db
          .select({
            rkey: zets.rkey,
            title: zets.title,
            date: zets.date,
            image: pages.image,
          })
          .from(zets)
          .innerJoin(pages, eq(zets.pageID, pages.id))
          .orderBy(desc(zets.date), desc(pages.created))
          .limit(RECENT_ZETS)
      : Promise.resolve([]),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      articles: as,
      recentClips,
      recentZets,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default data;
