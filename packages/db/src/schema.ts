import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const pages = sqliteTable("page", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated: text("updated")
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  image: text("image"),
  // 本文オブジェクトの R2 キー。Scrapbox 由来は Scrapbox ID、
  // diary 由来は mp-<uuid>。DB のカラム名は歴史的経緯で sbID のまま。
  bodyKey: text("sbID").notNull(),
});

export const articles = sqliteTable("article", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pageID: integer("pageID")
    .notNull()
    .references(() => pages.id),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const articleRelations = relations(articles, ({ one }) => ({
  page: one(pages, {
    fields: [articles.pageID],
    references: [pages.id],
  }),
}));

export const excludedPages = sqliteTable("excluded_page", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pageID: integer("pageID")
    .notNull()
    .references(() => pages.id),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const excludedPageRelations = relations(excludedPages, ({ one }) => ({
  page: one(pages, {
    fields: [excludedPages.pageID],
    references: [pages.id],
  }),
}));

export const clips = sqliteTable("clip", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pageID: integer("pageID")
    .notNull()
    .references(() => pages.id),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const clipRelations = relations(clips, ({ one }) => ({
  page: one(pages, {
    fields: [clips.pageID],
    references: [pages.id],
  }),
}));

export const onThisDayEntries = sqliteTable("on_this_day_entry", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pageID: integer("pageID")
    .notNull()
    .references(() => pages.id), // 親ページ (例: 0401) への参照
  targetPageID: integer("targetPageID")
    .notNull()
    .references(() => pages.id), // 実際の記事ページへの参照
  year: integer("year").notNull(), // 記事の年 (例: 2022)
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated: text("updated")
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const onThisDayEntryRelations = relations(
  onThisDayEntries,
  ({ one }) => ({
    page: one(pages, {
      fields: [onThisDayEntries.pageID],
      references: [pages.id],
      relationName: "on_this_day_page",
    }),
    targetPage: one(pages, {
      fields: [onThisDayEntries.targetPageID],
      references: [pages.id],
      relationName: "on_this_day_target_page",
    }),
  }),
);

// 類似度の計算世代。書き込みは INSERT のみで、表示の切り替えは current の UPDATE 1 行で行う。
// 途中まで入った run は current を立てなければ表示に出ないので、ロールバックが要らない。
export const similarityRuns = sqliteTable("similarity_run", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  model: text("model").notNull(),
  params: text("params").notNull(), // {"keep":50,"kr":10,"topN":20} を JSON 文字列で
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  current: integer("current", { mode: "boolean" }).notNull().default(false),
});

// rank を持たないのは、top N もしきい値も読み取り時に決めるため。
// score は raw cosine (足切り用)、adjusted は CSLS 補正後 (並べ替え用)。
export const pageSimilarities = sqliteTable(
  "page_similarity",
  {
    runID: integer("runID")
      .notNull()
      .references(() => similarityRuns.id),
    pageID: integer("pageID")
      .notNull()
      .references(() => pages.id),
    relatedPageID: integer("relatedPageID")
      .notNull()
      .references(() => pages.id),
    score: real("score").notNull(),
    adjusted: real("adjusted").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runID, t.pageID, t.relatedPageID] })],
);
