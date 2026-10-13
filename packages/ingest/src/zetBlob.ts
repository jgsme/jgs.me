import { drizzle } from "drizzle-orm/d1";
import { eq, gt } from "drizzle-orm";
import { pages, zets } from "@jigsaw/db";
import { r2KeyOf } from "@jigsaw/db/body-key";
import { zetPath } from "@jigsaw/db/zet";
import { putMedia } from "@jigsaw/media";
import { purge } from "./purge";
import {
  extractBlobURLs,
  markBlobImages,
  replaceBlobURLs,
  type FetchFn,
} from "./zetRecord";
import type { Env } from "./index";

// zet の画像は PDS (ds.jgs.me) の blob。getBlob を直に指すと Image
// Transformations も srcset も効かず、毎回原寸が PDS から返る。取り込み時に
// w-media へ写し、本文の URL を r2.jgs.me に差し替える。PDS の原本は触らない。

// blob の getBlob URL を R2 の URL にして返す。置けなければ null。
export type RehostBlob = (url: string) => Promise<string | null>;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// 写せなかった blob は getBlob のまま残す (表示は今まで通り PDS から出る)。
// 1 枚の失敗で取り込み全体は止めない。後から /internal/zet-rehost で拾える。
export async function rehostBlobs(
  urls: string[],
  rehost: RehostBlob,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (const url of urls) {
    try {
      const r = await rehost(url);
      if (r === null) {
        console.error(`[zet] blob not rehosted ${url}`);
        continue;
      }
      resolved.set(url, r);
    } catch (e) {
      console.error(`[zet] blob rehost failed ${url} ${message(e)}`);
    }
  }
  return resolved;
}

// 写した blob は R2 の URL に、写せなかったものは画像の印を付けて返す。
export async function rehostBlobImages(
  text: string,
  rehost: RehostBlob,
): Promise<{ text: string; resolved: Map<string, string> }> {
  const resolved = await rehostBlobs(extractBlobURLs(text), rehost);
  return { text: markBlobImages(replaceBlobURLs(text, resolved)), resolved };
}

// Workers の fetch は User-Agent を送らない (gyazoMigrate.ts と同じ理由で付ける)。
const USER_AGENT = "jgs-me/0.1.0 (+https://w.jgs.me/)";

export function blobRehoster(
  fetchFn: FetchFn,
  put: (bytes: ArrayBuffer, contentType: string) => Promise<string | null>,
  mediaBaseURL: string,
): RehostBlob {
  return async (url) => {
    const res = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`pds returned ${res.status}`);
    const type = res.headers.get("content-type");
    if (type === null) throw new Error("no content-type");
    // "image/png; charset=binary" のようにパラメータが付くことがある。
    const key = await put(await res.arrayBuffer(), type.split(";")[0]!.trim());
    return key === null ? null : `${mediaBaseURL}/${key}`;
  };
}

export function envRehoster(env: Env): RehostBlob {
  return blobRehoster(
    (input, init) => fetch(input, init),
    (bytes, type) => putMedia(env.MEDIA, bytes, type),
    env.MEDIA_BASE_URL,
  );
}

export type ZetRehostRow = {
  pageID: number;
  zetID: number;
  rkey: string;
  bodyKey: string;
  image: string | null;
  updated: string;
};

export type ZetRehostDeps = {
  listZets: (cursor: number, limit: number) => Promise<ZetRehostRow[]>;
  readBody: (bodyKey: string) => Promise<string | null>;
  writeBody: (bodyKey: string, body: string) => Promise<void>;
  setImage: (row: ZetRehostRow, image: string) => Promise<void>;
  purge: (paths: string[]) => Promise<void>;
  rehost: RehostBlob;
};

export type ZetRehostItem = {
  pageId: number;
  rkey: string;
  blobs: number;
  rehosted: number;
  error?: string;
};

// 取り込み済みの zet の本文を R2 の URL に差し替える。同じ blob は同じキー
// (内容の sha256) に落ちるので、何度流しても壊れない。
export async function runZetRehost(
  deps: ZetRehostDeps,
  cursor: number,
  limit: number,
): Promise<{
  processed: number;
  nextCursor: number | null;
  items: ZetRehostItem[];
}> {
  const rows = await deps.listZets(cursor, limit);
  const items: ZetRehostItem[] = [];

  for (const row of rows) {
    let blobs = 0;
    let rehosted = 0;
    let error: string | undefined;

    try {
      const raw = await deps.readBody(row.bodyKey);
      if (raw !== null) {
        blobs = extractBlobURLs(raw).length;
        const out = await rehostBlobImages(raw, deps.rehost);
        rehosted = out.resolved.size;
        if (rehosted > 0) {
          await deps.writeBody(row.bodyKey, out.text);
          if (row.image !== null) {
            const image = replaceBlobURLs(row.image, out.resolved);
            if (image !== row.image) await deps.setImage(row, image);
          }
          await deps.purge([
            "/zets",
            zetPath(row.rkey),
            `/p/${row.pageID}`,
            `/z/${row.zetID}`,
          ]);
        }
      }
    } catch (e) {
      // runMdBackfill と同じ理由。1 件で 500 にすると nextCursor が返らない。
      error = message(e);
    }

    items.push({
      pageId: row.pageID,
      rkey: row.rkey,
      blobs,
      rehosted,
      ...(error !== undefined ? { error } : {}),
    });
  }

  const nextCursor =
    rows.length === 0 || rows.length < limit
      ? null
      : rows[rows.length - 1]!.pageID;
  return { processed: rows.length, nextCursor, items };
}

// blob を落とすので 1 回あたりは小さめ (gyazoMigrate の FETCH_MAX と同じ考え)。
export const ZET_REHOST_DEFAULT_LIMIT = 10;

export async function handleZetRehost(
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
  const limit =
    body.limit === undefined ? ZET_REHOST_DEFAULT_LIMIT : Number(body.limit);
  if (!Number.isInteger(cursor) || cursor < 0) {
    return Response.json({ error: "cursor must be >= 0" }, { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return Response.json(
      { error: "limit must be between 1 and 50" },
      { status: 400 },
    );
  }

  const db = drizzle(env.DB);

  const deps: ZetRehostDeps = {
    listZets: (cursor, limit) =>
      db
        .select({
          pageID: pages.id,
          zetID: zets.id,
          rkey: zets.rkey,
          bodyKey: pages.bodyKey,
          image: pages.image,
          updated: pages.updated,
        })
        .from(zets)
        .innerJoin(pages, eq(pages.id, zets.pageID))
        .where(gt(pages.id, cursor))
        .orderBy(pages.id)
        .limit(limit),
    readBody: async (bodyKey) => {
      const key = r2KeyOf(bodyKey);
      if (!key) return null;
      const obj = await env.R2.get(key);
      return obj === null ? null : await obj.text();
    },
    writeBody: async (bodyKey, body) => {
      const key = r2KeyOf(bodyKey);
      if (!key) throw new Error(`invalid bodyKey: ${bodyKey}`);
      await env.R2.put(key, body, {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });
    },
    setImage: async (row, image) => {
      // URL の差し替えは編集ではないので updated は据え置く (gyazoMigrate と同じ)。
      await db
        .update(pages)
        .set({ image, updated: row.updated })
        .where(eq(pages.id, row.pageID));
    },
    purge: (paths) => purge(env, paths),
    rehost: envRehoster(env),
  };

  return Response.json(await runZetRehost(deps, cursor, limit));
}
