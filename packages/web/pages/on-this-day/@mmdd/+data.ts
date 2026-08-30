import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { articles, pages } from "@jigsaw/db";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { groupByYear, type DayArticle } from "./groupByYear";
import { adjacentDays, monthDayLabel, toMonthDay } from "./monthDay";

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { mmdd: string };
};

const data = async (c: Context) => {
  const config = useConfig();
  const mmdd = c.routeParams.mmdd;
  const monthDay = toMonthDay(mmdd);
  const adjacent = adjacentDays(mmdd);

  if (!monthDay || !adjacent) {
    config({ title: "On This Day - I am Electrical machine" });
    return { ok: false as const, mmdd, groups: [] };
  }

  const db = getDB(c.env.DB);

  // article は 2000 件台で、全件スキャンしても 1ms 未満。index は張っていない。
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      image: pages.image,
      date: articles.date,
    })
    .from(articles)
    .innerJoin(pages, eq(pages.id, articles.pageID))
    .where(
      and(
        isNotNull(articles.date),
        eq(sql`substr(${articles.date}, 6, 5)`, monthDay),
      ),
    )
    .orderBy(desc(articles.date));

  const label = monthDayLabel(mmdd);
  config({
    title: `${label} - I am Electrical machine`,
    description: `${label} に書いた記事`,
  });

  // date は schema 上 string | null。isNotNull で絞ってあるが型は narrow
  // されないので、ここで null を落として DayArticle に合わせる。
  const dayArticles: DayArticle[] = rows.flatMap((r) =>
    r.date === null
      ? []
      : [{ id: r.id, title: r.title, image: r.image, date: r.date }],
  );

  return {
    ok: true as const,
    mmdd,
    label,
    groups: groupByYear(dayArticles),
    prev: { mmdd: adjacent.prev, label: monthDayLabel(adjacent.prev) },
    next: { mmdd: adjacent.next, label: monthDayLabel(adjacent.next) },
  };
};

export default data;
