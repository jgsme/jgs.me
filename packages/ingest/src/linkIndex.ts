import { drizzle } from "drizzle-orm/d1";
import { eq, gt } from "drizzle-orm";
import { pageLinks, pages } from "@jigsaw/db";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { extractLinks } from "./links";
import type { Env } from "./index";

// 1 回の呼び出しで走査するページ数。R2 の GET が 1 ページ 1 回なので、
// Workers の subrequest 上限に当てない範囲にする。
export const DEFAULT_LIMIT = 50;

export type LinkPageRow = {
  id: number;
  title: string;
  bodyKey: string;
};

export type LinkIndexItem = {
  pageId: number;
  title: string;
  links: number;
  error?: string;
};

export type LinkIndexDeps = {
  listPages: (cursor: number, limit: number) => Promise<LinkPageRow[]>;
  readBody: (bodyKey: string, title: string) => Promise<string | null>;
  replaceLinks: (pageID: number, toTitles: string[]) => Promise<void>;
};

export async function runLinkIndex(
  deps: LinkIndexDeps,
  cursor: number,
  limit: number,
): Promise<{
  processed: number;
  nextCursor: number | null;
  items: LinkIndexItem[];
}> {
  const rows = await deps.listPages(cursor, limit);
  const items: LinkIndexItem[] = [];

  for (const row of rows) {
    try {
      const body = await deps.readBody(row.bodyKey, row.title);
      if (body === null) {
        // 本文が引けないページは索引を触らない。消すと、R2 の一時的な
        // 不調で既存の索引が飛ぶ。
        items.push({
          pageId: row.id,
          title: row.title,
          links: 0,
          error: "body not found",
        });
        continue;
      }

      const links = extractLinks(body);
      // 0 件でも呼ぶ。前回のリンクが残っていたら消す必要がある。
      await deps.replaceLinks(row.id, links);
      items.push({ pageId: row.id, title: row.title, links: links.length });
    } catch (e) {
      // 壊れた本文が 1 件あってもバッチ全体を止めない。
      // 何が壊れたかはレポートに残して人間に投げる。
      items.push({
        pageId: row.id,
        title: row.title,
        links: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // limit に届かなかった = 最後まで来た。rows.length === 0 を先に見るのは
  // limit=0 で rows[-1] を踏まないため。
  const nextCursor =
    rows.length === 0 || rows.length < limit ? null : rows[rows.length - 1]!.id;
  return { processed: rows.length, nextCursor, items };
}

type Body = { cursor?: unknown; limit?: unknown };

export async function handleLinkIndex(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // gyazoMigrate.ts の handleGyazoMigrate と同じ検査。
  // limit=-1 は SQLite の LIMIT -1 で「無制限」になり、全ページを 1
  // リクエストで舐めてしまうので弾く。limit=0 は runLinkIndex 側で
  // rows[-1] を踏まないよう直したが、そもそも 0 件処理する意味が無いので
  // 下限は 1。
  if (body.cursor !== undefined) {
    if (
      typeof body.cursor !== "number" ||
      !Number.isInteger(body.cursor) ||
      body.cursor < 0
    ) {
      return new Response("cursor must be an integer >= 0", { status: 400 });
    }
  }
  if (body.limit !== undefined) {
    if (
      typeof body.limit !== "number" ||
      !Number.isInteger(body.limit) ||
      body.limit < 1 ||
      body.limit > 100
    ) {
      return new Response("limit must be an integer between 1 and 100", {
        status: 400,
      });
    }
  }

  const cursor = typeof body.cursor === "number" ? body.cursor : 0;
  const limit = typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT;

  const db = drizzle(env.DB);

  const deps: LinkIndexDeps = {
    // 全ページが対象。excluded_page も索引には入れる (出すかどうかは
    // 読み側で決める。索引を作り直さずに方針を変えられるようにしておく)。
    listPages: (c, l) =>
      db
        .select({ id: pages.id, title: pages.title, bodyKey: pages.bodyKey })
        .from(pages)
        .where(gt(pages.id, c))
        .orderBy(pages.id)
        .limit(l),
    // Scrapbox アーカイブ (.json) と Micropub (.sb) の両方を吸う。
    readBody: (bodyKey, title) => fetchBody(env.R2, bodyKey, title),
    replaceLinks: async (pageID, toTitles) => {
      const clear = db
        .delete(pageLinks)
        .where(eq(pageLinks.fromPageID, pageID));
      if (toTitles.length === 0) {
        await clear;
        return;
      }
      await db.batch([
        clear,
        db
          .insert(pageLinks)
          .values(toTitles.map((toTitle) => ({ fromPageID: pageID, toTitle }))),
      ]);
    },
  };

  const result = await runLinkIndex(deps, cursor, limit);
  return Response.json(result);
}
