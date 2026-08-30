import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { articles } from "@jigsaw/db";
import { isNotNull, sql } from "drizzle-orm";
import { useConfig } from "vike-react/useConfig";
import { buildIndex, type OnThisDayIndex } from "./buildIndex";

// 型の定義は buildIndex.ts にある。utils.ts など既存の import 元を
// 変えずに済むよう、ここから re-export する。
export type { OnThisDayIndex };

export type Data = {
  index: OnThisDayIndex;
};

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context): Promise<Data> => {
  // Task 7 で +Head.tsx から移した分。+Head.tsx の内容は子ルートに累積して
  // 打ち消せないので、title と description はここで設定する。
  const config = useConfig();
  config({
    title: "On This Day - I am Electrical machine",
    description: "Overview of articles published on this day over the years.",
  });

  try {
    const db = getDB(c.env.DB);

    // 全 article の GROUP BY で 3ms 程度。R2 の index.json を経由するより速い。
    const rows = await db
      .select({
        mmdd: sql<string>`substr(${articles.date}, 6, 2) || substr(${articles.date}, 9, 2)`,
        year: sql<number>`CAST(substr(${articles.date}, 1, 4) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(articles)
      .where(isNotNull(articles.date))
      .groupBy(
        sql`substr(${articles.date}, 6, 2) || substr(${articles.date}, 9, 2)`,
        sql`substr(${articles.date}, 1, 4)`,
      );

    return { index: buildIndex(rows) };
  } catch (e) {
    console.error("Error building on-this-day index from D1:", e);
    return { index: { years: [], entries: {} } };
  }
};

export default data;
