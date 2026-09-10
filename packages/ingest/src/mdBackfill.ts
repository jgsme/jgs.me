import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt, isNotNull, or } from "drizzle-orm";
import { articles, clips, pages } from "@jigsaw/db";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { buildMdPut, type MdPut } from "./mdBody";
import type { Env } from "./index";

export type MdBackfillRow = {
  id: number;
  title: string;
  bodyKey: string;
};

export type MdBackfillDeps = {
  // article か clip として登録されているページだけを id 昇順で返す。
  listPages: (cursor: number, limit: number) => Promise<MdBackfillRow[]>;
  readBody: (bodyKey: string, title: string) => Promise<string | null>;
  writeMd: (put: MdPut) => Promise<void>;
};

export type MdBackfillItem = {
  pageId: number;
  title: string;
  written: boolean;
  error?: string;
};

export async function runMdBackfill(
  deps: MdBackfillDeps,
  cursor: number,
  limit: number,
): Promise<{
  processed: number;
  nextCursor: number | null;
  items: MdBackfillItem[];
}> {
  const rows = await deps.listPages(cursor, limit);
  const items: MdBackfillItem[] = [];

  for (const row of rows) {
    let written = false;
    let error: string | undefined;

    try {
      const raw = await deps.readBody(row.bodyKey, row.title);
      // 本文が引けない page は実在する (fetchBody も [R2 miss] を吐いて
      // null を返すだけ)。書かずに次へ行く。
      const put = raw === null ? null : buildMdPut(row.bodyKey, raw);
      if (put) {
        await deps.writeMd(put);
        written = true;
      }
    } catch (e) {
      // runScan / runRewrite と同じ理由。1 件の例外でリクエストごと 500 に
      // すると nextCursor が返らず、同じ cursor で毎回そこで止まる。
      error = e instanceof Error ? e.message : String(e);
    }

    items.push({
      pageId: row.id,
      title: row.title,
      written,
      ...(error !== undefined ? { error } : {}),
    });
  }

  const nextCursor =
    rows.length === 0 || rows.length < limit ? null : rows[rows.length - 1]!.id;
  return { processed: rows.length, nextCursor, items };
}

// D1 / R2 の binding をロジックの依存に差すだけの層 (handleGyazoMigrate と同じ)。
export async function handleMdBackfill(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: { cursor?: unknown; limit?: unknown };
  try {
    body = (await request.json()) as { cursor?: unknown; limit?: unknown };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const cursor = body.cursor === undefined ? 0 : Number(body.cursor);
  const limit = body.limit === undefined ? 50 : Number(body.limit);
  if (!Number.isInteger(cursor) || cursor < 0) {
    return Response.json({ error: "cursor must be >= 0" }, { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return Response.json({ error: "limit must be >= 1" }, { status: 400 });
  }

  const db = drizzle(env.DB);

  const deps: MdBackfillDeps = {
    // article と clip の leftJoin。両方に居るページが 2 件あるが、どちらの
    // join も 1 行までしか当たらないので行は重複しない。
    listPages: (cursor, limit) =>
      db
        .select({
          id: pages.id,
          title: pages.title,
          bodyKey: pages.bodyKey,
        })
        .from(pages)
        .leftJoin(articles, eq(articles.pageID, pages.id))
        .leftJoin(clips, eq(clips.pageID, pages.id))
        .where(
          and(
            gt(pages.id, cursor),
            or(isNotNull(articles.id), isNotNull(clips.id)),
          ),
        )
        .orderBy(pages.id)
        .limit(limit),
    readBody: (bodyKey, title) => fetchBody(env.R2, bodyKey, title),
    writeMd: async (put) => {
      await env.MD.put(put.key, put.body, {
        httpMetadata: { contentType: put.contentType },
      });
    },
  };

  return Response.json(await runMdBackfill(deps, cursor, limit));
}
