import { drizzle } from "drizzle-orm/d1";
import { eq, gt, inArray } from "drizzle-orm";
import { articles, gyazoMedia, pages } from "@jigsaw/db";
import { r2KeyOf } from "@jigsaw/db/body-key";
import { countScrapboxFiles, extractGyazoHashes, gyazoRawURL } from "./gyazo";
import { bodyTextOf } from "./gyazoBody";
import { putMedia } from "./media";
import type { Env } from "./index";

// Workers の fetch は User-Agent を送らない。UA 無しを弾く実装が実在するので
// (packages/ap/src/config.ts の USER_AGENT と同じ理由) 外向きには必ず付ける。
const USER_AGENT = "jgs-me/0.1.0 (+https://w.jgs.me/)";

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

// 1 回の呼び出しで投げる HEAD の上限。Workers の subrequest 上限に当てない。
export const PROBE_MAX = 40;

export type ProbeItem = {
  gyazoHash: string;
  status: number;
  bytes: number | null;
  contentType: string | null;
};

export type ProbeDeps = {
  head: (url: string) => Promise<{
    status: number;
    contentLength: string | null;
    contentType: string | null;
  }>;
};

export async function runProbe(
  deps: ProbeDeps,
  hashes: string[],
): Promise<{ processed: number; items: ProbeItem[] }> {
  const items: ProbeItem[] = [];

  for (const hash of hashes) {
    try {
      const res = await deps.head(gyazoRawURL(hash));
      const n = Number(res.contentLength);
      items.push({
        gyazoHash: hash,
        status: res.status,
        bytes: Number.isFinite(n) && res.contentLength !== null ? n : null,
        contentType: res.contentType,
      });
    } catch {
      // 通信エラー。1 件で残りの打診を捨てない。status 0 で人間に見せる。
      items.push({ gyazoHash: hash, status: 0, bytes: null, contentType: null });
    }
  }

  return { processed: items.length, items };
}

// 1 回の呼び出しで落とす画像の上限。probe より小さいのは 1 件が重いため。
export const FETCH_MAX = 10;

export type FetchItem =
  | { gyazoHash: string; r2Key: string; bytes: number; contentType: string }
  | { gyazoHash: string; error: string };

export type FetchDeps = {
  known: (hashes: string[]) => Promise<Set<string>>;
  download: (url: string) => Promise<{
    status: number;
    contentType: string | null;
    body: ArrayBuffer;
  }>;
  put: (bytes: ArrayBuffer, contentType: string) => Promise<string | null>;
  record: (row: {
    gyazoHash: string;
    r2Key: string;
    contentType: string;
    bytes: number;
  }) => Promise<void>;
};

export async function runFetch(
  deps: FetchDeps,
  hashes: string[],
): Promise<{ processed: number; items: FetchItem[] }> {
  const skip = await deps.known(hashes);
  const items: FetchItem[] = [];

  for (const hash of hashes) {
    // 取り込み済みは触らない。再実行を安くするため。
    if (skip.has(hash)) continue;

    try {
      const res = await deps.download(gyazoRawURL(hash));
      if (res.status !== 200) {
        items.push({ gyazoHash: hash, error: `status ${res.status}` });
        continue;
      }
      if (res.contentType === null) {
        items.push({ gyazoHash: hash, error: "no content-type" });
        continue;
      }

      // "image/png; charset=binary" のようにパラメータが付くことがある。
      const contentType = res.contentType.split(";")[0]!.trim();
      const r2Key = await deps.put(res.body, contentType);
      if (r2Key === null) {
        items.push({
          gyazoHash: hash,
          error: `unsupported content type: ${contentType}`,
        });
        continue;
      }

      const bytes = res.body.byteLength;
      await deps.record({ gyazoHash: hash, r2Key, contentType, bytes });
      items.push({ gyazoHash: hash, r2Key, bytes, contentType });
    } catch (e) {
      items.push({
        gyazoHash: hash,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { processed: hashes.length, items };
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

  const head: ProbeDeps["head"] = async (url) => {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    return {
      status: res.status,
      contentLength: res.headers.get("content-length"),
      contentType: res.headers.get("content-type"),
    };
  };

  const fetchDeps: FetchDeps = {
    known: async (hashes) => {
      // 空配列だと inArray が不正な SQL になる。
      if (hashes.length === 0) return new Set();
      const rows = await db
        .select({ gyazoHash: gyazoMedia.gyazoHash })
        .from(gyazoMedia)
        .where(inArray(gyazoMedia.gyazoHash, hashes));
      return new Set(rows.map((r) => r.gyazoHash));
    },
    download: async (url) => {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
      });
      return {
        status: res.status,
        contentType: res.headers.get("content-type"),
        body: await res.arrayBuffer(),
      };
    },
    put: (bytes, contentType) => putMedia(env.MEDIA, bytes, contentType),
    record: async (row) => {
      await db.insert(gyazoMedia).values(row);
    },
  };

  function parseHashes(input: unknown, max: number): string[] | null {
    if (!Array.isArray(input)) return null;
    if (input.length > max) return null;
    if (!input.every((h) => typeof h === "string" && /^[0-9a-f]{32}$/.test(h))) {
      return null;
    }
    return input as string[];
  }

  const cursor = typeof body.cursor === "number" ? body.cursor : 0;
  const limit = typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT;

  if (body.phase === "scan") {
    const r = await runScan({ listArticlePages, readBody }, cursor, limit);
    return Response.json({ phase: "scan", ...r });
  }

  if (body.phase === "probe") {
    const hashes = parseHashes(body.hashes, PROBE_MAX);
    if (hashes === null) {
      return bad(`hashes must be up to ${PROBE_MAX} gyazo hashes`);
    }
    const r = await runProbe({ head }, hashes);
    return Response.json({ phase: "probe", nextCursor: null, ...r });
  }

  if (body.phase === "fetch") {
    const hashes = parseHashes(body.hashes, FETCH_MAX);
    if (hashes === null) {
      return bad(`hashes must be up to ${FETCH_MAX} gyazo hashes`);
    }
    const r = await runFetch(fetchDeps, hashes);
    return Response.json({ phase: "fetch", nextCursor: null, ...r });
  }

  return bad(`unknown phase: ${String(body.phase)}`);
}
