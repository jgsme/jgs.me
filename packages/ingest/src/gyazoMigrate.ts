import { drizzle } from "drizzle-orm/d1";
import { eq, gt } from "drizzle-orm";
import { articles, pages } from "@jigsaw/db";
import { r2KeyOf } from "@jigsaw/db/body-key";
import { countScrapboxFiles, extractGyazoHashes } from "./gyazo";
import { bodyTextOf } from "./gyazoBody";
import type { Env } from "./index";

export const DEFAULT_LIMIT = 20;

export type PageRow = {
  id: number;
  title: string;
  bodyKey: string;
  image: string | null;
  updated: string;
};

export type ScanItem = {
  pageId: number;
  title: string;
  hashes: string[];
  imageHash: string | null;
  scrapboxFiles: number;
  error?: string;
};

export type ScanDeps = {
  listArticlePages: (cursor: number, limit: number) => Promise<PageRow[]>;
  readBody: (bodyKey: string) => Promise<string | null>;
};

export async function runScan(
  deps: ScanDeps,
  cursor: number,
  limit: number,
): Promise<{
  processed: number;
  nextCursor: number | null;
  items: ScanItem[];
}> {
  const rows = await deps.listArticlePages(cursor, limit);
  const items: ScanItem[] = [];

  for (const row of rows) {
    const item: ScanItem = {
      pageId: row.id,
      title: row.title,
      hashes: [],
      imageHash:
        row.image === null ? null : (extractGyazoHashes(row.image)[0] ?? null),
      scrapboxFiles: 0,
    };

    const raw = await deps.readBody(row.bodyKey);
    if (raw !== null) {
      try {
        const text = bodyTextOf(row.bodyKey, raw);
        item.hashes = extractGyazoHashes(text);
        item.scrapboxFiles = countScrapboxFiles(text);
      } catch (e) {
        // 壊れた本文が 1 件あってもバッチ全体を止めない。
        // 何が壊れたかはレポートに残して人間に投げる。
        item.error = e instanceof Error ? e.message : String(e);
      }
    }

    items.push(item);
  }

  // limit に届かなかった = 最後まで来た。
  const nextCursor = rows.length < limit ? null : rows[rows.length - 1]!.id;
  return { processed: rows.length, nextCursor, items };
}

type Body = {
  phase?: unknown;
  cursor?: unknown;
  limit?: unknown;
  hashes?: unknown;
};

function bad(description: string): Response {
  return Response.json({ error: description }, { status: 400 });
}

// D1 / R2 の binding をロジックの依存に差すだけの層。
export async function handleGyazoMigrate(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("invalid json");
  }

  const db = drizzle(env.DB);

  const listArticlePages = (cursor: number, limit: number) =>
    db
      .select({
        id: pages.id,
        title: pages.title,
        bodyKey: pages.bodyKey,
        image: pages.image,
        updated: pages.updated,
      })
      .from(articles)
      .innerJoin(pages, eq(pages.id, articles.pageID))
      .where(gt(pages.id, cursor))
      .orderBy(pages.id)
      .limit(limit);

  const readBody = async (bodyKey: string): Promise<string | null> => {
    const key = r2KeyOf(bodyKey);
    if (!key) return null;
    const obj = await env.R2.get(key);
    return obj === null ? null : await obj.text();
  };

  const cursor = typeof body.cursor === "number" ? body.cursor : 0;
  const limit = typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT;

  if (body.phase === "scan") {
    const r = await runScan({ listArticlePages, readBody }, cursor, limit);
    return Response.json({ phase: "scan", ...r });
  }

  return bad(`unknown phase: ${String(body.phase)}`);
}
