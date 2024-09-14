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
