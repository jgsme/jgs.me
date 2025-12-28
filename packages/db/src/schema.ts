import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  sbID: text("sbID").notNull(),
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

export const onThisDayEntryRelations = relations(onThisDayEntries, ({ one }) => ({
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
}));
