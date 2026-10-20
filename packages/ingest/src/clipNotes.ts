import { drizzle } from "drizzle-orm/d1";
import { eq, gt } from "drizzle-orm";
import { clips, pages } from "@jigsaw/db";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { buildClipNote, type MarginNote } from "./clipNote";
import type { Env } from "./index";

export type ClipNoteRow = {
  readonly clipId: number;
  readonly title: string;
  readonly created: string;
  readonly bodyKey: string;
};

export type ClipNotesDeps = {
  // clip を id 昇順で返す。
  readonly listClips: (
    cursor: number,
    limit: number,
  ) => Promise<readonly ClipNoteRow[]>;
  readonly readBody: (bodyKey: string, title: string) => Promise<string | null>;
};

export type ClipNoteItem = {
  readonly clipId: number;
  readonly title: string;
  readonly note?: MarginNote;
  readonly warnings?: readonly string[];
  readonly skip?: string;
};

async function convert(
  deps: ClipNotesDeps,
  row: ClipNoteRow,
): Promise<ClipNoteItem> {
  const base = { clipId: row.clipId, title: row.title };
  try {
    const body = await deps.readBody(row.bodyKey, row.title);
    if (body === null) return { ...base, skip: "本文が読めない" };
    const r = await buildClipNote({
      title: row.title,
      created: row.created,
      body,
    });
    return r.ok
      ? { ...base, note: r.note, warnings: r.warnings }
      : { ...base, skip: r.reason };
  } catch (e) {
    // 1 件の例外でリクエストごと 500 にすると nextCursor が返らず、同じ cursor で止まり続ける。
    return { ...base, skip: e instanceof Error ? e.message : String(e) };
  }
}

// PDS には書かない。書き込みは CLI (pnpm clip-margin) が持つ。
export async function runClipNotes(
  deps: ClipNotesDeps,
  cursor: number,
  limit: number,
): Promise<{
  readonly processed: number;
  readonly nextCursor: number | null;
  readonly items: readonly ClipNoteItem[];
}> {
  const rows = await deps.listClips(cursor, limit);
  const items = await Promise.all(rows.map((row) => convert(deps, row)));
  const last = rows.at(-1);
  const nextCursor = !last || rows.length < limit ? null : last.clipId;
  return { processed: rows.length, nextCursor, items };
}

const DEFAULT_LIMIT = 50;
const BAD_REQUEST = 400;

export async function handleClipNotes(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    cursor?: unknown;
    limit?: unknown;
  } | null;
  if (body === null) {
    return Response.json({ error: "invalid json" }, { status: BAD_REQUEST });
  }

  const cursor = body.cursor === undefined ? 0 : Number(body.cursor);
  const limit = body.limit === undefined ? DEFAULT_LIMIT : Number(body.limit);
  if (!Number.isInteger(cursor) || cursor < 0) {
    return Response.json(
      { error: "cursor must be >= 0" },
      { status: BAD_REQUEST },
    );
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return Response.json(
      { error: "limit must be >= 1" },
      { status: BAD_REQUEST },
    );
  }

  const db = drizzle(env.DB);
  const deps: ClipNotesDeps = {
    listClips: (cursor, limit) =>
      db
        .select({
          clipId: clips.id,
          title: pages.title,
          created: pages.created,
          bodyKey: pages.bodyKey,
        })
        .from(clips)
        .innerJoin(pages, eq(clips.pageID, pages.id))
        .where(gt(clips.id, cursor))
        .orderBy(clips.id)
        .limit(limit),
    readBody: (bodyKey, title) => fetchBody(env.R2, bodyKey, title),
  };

  return Response.json(await runClipNotes(deps, cursor, limit));
}
