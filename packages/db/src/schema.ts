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
  // 本文オブジェクトの R2 キー。Scrapbox 由来は Scrapbox ID (R2 上は
  // <bodyKey>.json)、diary (Micropub) 由来は sb-<uuid> (R2 上は
  // <bodyKey>.sb、1行目が題の Scrapbox 記法プレーンテキスト)。
  // DB のカラム名は歴史的経緯で sbID のまま。
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
  // 記事が書かれた日 "YYYY-MM-DD"。決まらない記事は null で、周年日記に出ない。
  // created はページが D1 に入った時刻で、記事が書かれた日ではない。
  date: text("date"),
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

// ActivityPub / AT Protocol の native 表現と ID マッピング。
// 記事の実体は page と R2 が持ち、ここは federation 固有の情報だけを隔離する。
// pivot 形式 (AS2) を都度導出できるよう、各プロトコルの原本をそのまま保存する。
export const objects = sqliteTable("object", {
  // 正準 URI。自分の記事は https://w.jgs.me/o/<page.id>、外部由来は相手の URI。
  id: text("id").primaryKey(),
  // 自分の記事のときだけ入る。外部から受信したオブジェクトは null。
  pageID: integer("pageID").references(() => pages.id),
  sourceProtocol: text("source_protocol").notNull(), // 'ap' | 'web' | 'atproto'
  as2: text("as2"),
  mf2: text("mf2"),
  atproto: text("atproto"),
  ourAs2: text("our_as2"),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated: text("updated")
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

// 同一オブジェクトの他プロトコルでの複製。
// objectID には object.id が入る。それ以外の用途に流用しない。
// cid は AT Protocol 専用。AS2 に CID を置く場所がなく、
// pivot を往復させると空文字になるため独立したカラムで持つ。
export const copies = sqliteTable(
  "copy",
  {
    objectID: text("objectID").notNull(),
    protocol: text("protocol").notNull(),
    uri: text("uri").notNull(),
    cid: text("cid"),
  },
  (t) => [primaryKey({ columns: [t.objectID, t.protocol] })],
);

// 受信した反応。ActivityPub 経由と Webmention 経由を同じテーブルに入れる。
// 読者にとって「Mastodon の Like」と「IndieWeb の u-like-of」は同じものなので、
// 表示層は source_protocol を見ない。
export const reactions = sqliteTable("reaction", {
  id: text("id").primaryKey(),
  targetPageID: integer("targetPageID")
    .notNull()
    .references(() => pages.id),
  sourceProtocol: text("source_protocol").notNull(), // 'ap' | 'web'
  kind: text("kind").notNull(), // like | emoji | announce | reply | mention
  emoji: text("emoji"),
  actorName: text("actor_name"),
  actorURL: text("actor_url"),
  actorIcon: text("actor_icon"),
  content: text("content"),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  // Undo(Like) 等で取り消されたときに立てる。行は消さず履歴として残す。
  undone: integer("undone", { mode: "boolean" }).notNull().default(false),
});

export const followers = sqliteTable("follower", {
  id: text("id").primaryKey(), // follower の actor URI
  protocol: text("protocol").notNull(),
  inbox: text("inbox").notNull(),
  sharedInbox: text("shared_inbox"),
  state: text("state").notNull(), // 'pending' | 'accepted'
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// Gyazo から取り込んだ画像の対応表。
// R2 のキーは内容の sha256 なので、この表が無いとキーから元の Gyazo 画像に
// 戻れない。取り込みの再実行判断とロールバックがこの表に乗る。
// 取得に失敗した画像は行を作らない。差し替え側は「表に無い = 触らない」で動く。
export const gyazoMedia = sqliteTable("gyazo_media", {
  gyazoHash: text("gyazoHash").primaryKey(),
  r2Key: text("r2Key").notNull(),
  contentType: text("contentType").notNull(),
  bytes: integer("bytes").notNull(),
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
