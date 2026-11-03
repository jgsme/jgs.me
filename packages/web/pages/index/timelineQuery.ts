import { articles, clips, druck, pages, zets } from "@jigsaw/db";
import type { getDB } from "@/db/getDB";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { union } from "drizzle-orm/sqlite-core";
import { DAYS_PER_PAGE } from "./timeline";

type DB = ReturnType<typeof getDB>;

// page.created は UTC で、形式が 2 通り混ざる (ISO と "YYYY-MM-DD HH:MM:SS")。
// date() はどちらも読める。JST の日にするため +9 時間する
const jstDay = sql<string>`date(${pages.created}, '+9 hours')`;

// 記事が書かれた日。決まらない記事は取り込み日 (JST) で代用する
export const articleDay = sql<string>`coalesce(${articles.date}, ${jstDay})`;
// clip.created は再登録の時刻が入るので使わず、page.created を使う
export const clipDay = jstDay;

// 日の候補を 4 種から集めて降順に並べる。union は重複を落とすので distinct は要らない。
// 次ページがあるか見るため 1 日多く引く
export function dayWindowQuery(db: DB, page: number) {
  return union(
    db
      .select({ day: articleDay.as("day") })
      .from(articles)
      .innerJoin(pages, eq(articles.pageID, pages.id)),
    db.select({ day: sql<string>`${zets.date}`.as("day") }).from(zets),
    db.select({ day: sql<string>`${druck.date}`.as("day") }).from(druck),
    db
      .select({ day: clipDay.as("day") })
      .from(clips)
      .innerJoin(pages, eq(clips.pageID, pages.id)),
  )
    .orderBy(desc(sql`day`))
    .limit(DAYS_PER_PAGE + 1)
    .offset((page - 1) * DAYS_PER_PAGE);
}

export async function fetchDayWindow(
  db: DB,
  page: number,
): Promise<{ days: string[]; hasNext: boolean }> {
  const rows = await dayWindowQuery(db, page);
  const days = rows.map((r) => r.day);
  return {
    days: days.slice(0, DAYS_PER_PAGE),
    hasNext: days.length > DAYS_PER_PAGE,
  };
}

export type PageRow = {
  id: number;
  title: string;
  image: string | null;
  created: string;
  day: string;
  spoiler: boolean;
  bodyKey: string;
};
export type ZetRow = PageRow & {
  rkey: string;
  zetTitle: string | null;
  zetDate: string;
};

const pageCols = {
  id: pages.id,
  title: pages.title,
  image: pages.image,
  created: pages.created,
  spoiler: pages.spoiler,
  bodyKey: pages.bodyKey,
};

const inRange = (day: SQL<string>, oldest: string, newest: string) =>
  and(gte(day, oldest), lte(day, newest));

export async function fetchEntriesInRange(
  db: DB,
  oldest: string,
  newest: string,
): Promise<{
  articles: PageRow[];
  zets: ZetRow[];
  clips: PageRow[];
  drucks: PageRow[];
}> {
  const [a, z, c, d] = await Promise.all([
    db
      .select({ ...pageCols, day: articleDay })
      .from(articles)
      .innerJoin(pages, eq(articles.pageID, pages.id))
      .where(inRange(articleDay, oldest, newest)),
    db
      .select({
        ...pageCols,
        day: sql<string>`${zets.date}`,
        rkey: zets.rkey,
        zetTitle: zets.title,
        zetDate: zets.date,
      })
      .from(zets)
      .innerJoin(pages, eq(zets.pageID, pages.id))
      .where(and(gte(zets.date, oldest), lte(zets.date, newest))),
    db
      .select({ ...pageCols, day: clipDay })
      .from(clips)
      .innerJoin(pages, eq(clips.pageID, pages.id))
      .where(inRange(clipDay, oldest, newest)),
    db
      .select({ ...pageCols, day: sql<string>`${druck.date}` })
      .from(druck)
      .innerJoin(pages, eq(druck.pageID, pages.id))
      .where(and(gte(druck.date, oldest), lte(druck.date, newest))),
  ]);
  return { articles: a, zets: z, clips: c, drucks: d };
}

export async function fetchLatestArticle(db: DB): Promise<PageRow | null> {
  const rows = await db
    .select({ ...pageCols, day: articleDay })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .orderBy(desc(articleDay), desc(pages.created))
    .limit(1);
  return rows[0] ?? null;
}
