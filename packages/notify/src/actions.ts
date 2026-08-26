import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { articles, clips, excludedPages, pages } from "@jigsaw/db";
import { resolveArticleDate } from "@jigsaw/db/article-date";
import { fetchBody } from "@jigsaw/db/fetch-body";
import type { Action, ActionResult } from "./types";

type DB = DrizzleD1Database<Record<string, never>>;

export async function applyAction(
  db: DB,
  action: Action,
  pageId: number,
): Promise<ActionResult> {
  const [page] = await db
    .select({ title: pages.title })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page) return { status: "notfound" };

  switch (action) {
    case "register": {
      const [hit] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.pageID, pageId))
        .limit(1);
      if (hit) return { status: "already", title: page.title };
      await db.insert(articles).values({ pageID: pageId });
      return { status: "ok", title: page.title };
    }
    case "clip": {
      const [hit] = await db
        .select({ id: clips.id })
        .from(clips)
        .where(eq(clips.pageID, pageId))
        .limit(1);
      if (hit) return { status: "already", title: page.title };
      await db.insert(clips).values({ pageID: pageId });
      return { status: "ok", title: page.title };
    }
    case "exclude": {
      const [hit] = await db
        .select({ id: excludedPages.id })
        .from(excludedPages)
        .where(eq(excludedPages.pageID, pageId))
        .limit(1);
      if (hit) return { status: "already", title: page.title };
      await db.insert(excludedPages).values({ pageID: pageId });
      return { status: "ok", title: page.title };
    }
  }
}

// 記事を公開したので ActivityPub のフォロワーへ配送する。
// 失敗しても記事の登録自体は成功させる (配送は後から再実行できる)。
// Service Binding の fetch はホスト名を見ない。パスだけが ap に届く。
export async function publishToAP(ap: Fetcher, pageId: number): Promise<void> {
  try {
    await ap.fetch("https://ap.internal/internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageID: pageId, kind: "create" }),
    });
  } catch (e) {
    console.error(`[publish] failed pageID=${pageId} ${String(e)}`);
  }
}

// 記事の日付を決めて article.date に書く。決まらなければ何も書かない。
// register の interaction は 3 秒で返す必要があるため、呼び出し側は
// ctx.waitUntil に逃がす。
export async function resolveAndStoreDate(
  db: DB,
  r2: R2Bucket,
  pageId: number,
): Promise<string | null> {
  const [page] = await db
    .select({
      bodyKey: pages.bodyKey,
      title: pages.title,
      created: pages.created,
    })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page) return null;

  const body = await fetchBody(r2, page.bodyKey, page.title);
  const date = resolveArticleDate({
    body,
    title: page.title,
    bodyKey: page.bodyKey,
    created: page.created,
  });

  if (!date) return null;

  await db
    .update(articles)
    .set({ date })
    .where(eq(articles.pageID, pageId));

  return date;
}
