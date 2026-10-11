import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { copies, objects, pageLinks, pages, zets } from "@jigsaw/db";
import { newSbBodyKey, r2KeyOf } from "@jigsaw/db/body-key";
import { ZET_COPY_PROTOCOL } from "@jigsaw/db/zet";
import { chunk } from "./rows";
import { SITE_URL, objectURI } from "./site";
import { purge } from "./purge";
import { fetchZetRecord } from "./zetRecord";
import {
  ingestZet,
  type ZetCreateInput,
  type ZetDeps,
  type ZetTarget,
  type ZetUpdateInput,
} from "./zet";
import type { Env } from "./index";

export type DB = DrizzleD1Database<Record<string, never>>;
type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

// batch の中では page.id がまだ分からない。page.title は UNIQUE なので、
// 同じ batch の先頭で入れた page を題で引き直す。
function pageIDOf(pageTitle: string) {
  return sql`(SELECT id FROM page WHERE title = ${pageTitle})`;
}

function objectIDOf(pageTitle: string) {
  return sql`${`${SITE_URL}/o/`} || ${pageIDOf(pageTitle)}`;
}

// page + zet + object + copy (+ page_link) を 1 batch で入れる (spec)。
// batch は 1 回の D1 呼び出しかつトランザクションなので、途中で落ちれば
// 何も残らない。page_link は micropub.ts と同じ理由で 16 行ずつに刻む。
export function zetCreateStatements(db: DB, input: ZetCreateInput): Batch {
  const pageID = pageIDOf(input.pageTitle);
  const objectID = objectIDOf(input.pageTitle);
  return [
    db.insert(pages).values({
      title: input.pageTitle,
      bodyKey: input.bodyKey,
      created: input.created,
      updated: input.created,
      image: input.image,
    }),
    db.insert(zets).values({
      pageID,
      rkey: input.rkey,
      date: input.date,
      title: input.zetTitle,
      created: input.created,
    }),
    db.insert(objects).values({
      id: objectID,
      pageID,
      // 原本は PDS の record。mf2 は通知 (at-uri だけ) なので、Micropub の
      // q=source / update の土台にはならない (それらは source_protocol = web
      // の行しか見ないので、zet の URL を渡されても 400 になる)。
      sourceProtocol: "atproto",
      atproto: input.atproto,
      mf2: input.mf2,
      deleted: false,
      created: input.created,
      updated: input.created,
    }),
    db.insert(copies).values({
      objectID,
      protocol: ZET_COPY_PROTOCOL,
      uri: input.atUri,
      cid: input.cid,
    }),
    ...chunk(input.links, 16).map((group) =>
      db
        .insert(pageLinks)
        .values(group.map((toTitle) => ({ fromPageID: pageID, toTitle }))),
    ),
  ];
}

export function zetUpdateStatements(db: DB, input: ZetUpdateInput): Batch {
  const objectID = objectURI(input.pageID);
  return [
    // page.title / bodyKey は変えない (rkey と R2 のキーは record の一生で不変)。
    db
      .update(pages)
      .set({ image: input.image, updated: input.updated })
      .where(eq(pages.id, input.pageID)),
    db
      .update(zets)
      .set({ date: input.date, title: input.zetTitle })
      .where(eq(zets.pageID, input.pageID)),
    db
      .update(copies)
      .set({ cid: input.cid })
      .where(
        and(
          eq(copies.objectID, objectID),
          eq(copies.protocol, ZET_COPY_PROTOCOL),
        ),
      ),
    db
      .update(objects)
      .set({ atproto: input.atproto, mf2: input.mf2, updated: input.updated })
      .where(eq(objects.id, objectID)),
    // 被リンクは micropub.ts の update と同じく全消し + 入れ直し。
    db.delete(pageLinks).where(eq(pageLinks.fromPageID, input.pageID)),
    ...chunk(input.links, 16).map((group) =>
      db
        .insert(pageLinks)
        .values(
          group.map((toTitle) => ({ fromPageID: input.pageID, toTitle })),
        ),
    ),
  ];
}

export async function findZetByAtUri(
  db: DB,
  atUri: string,
): Promise<ZetTarget | null> {
  const [row] = await db
    .select({ pageID: pages.id, bodyKey: pages.bodyKey, cid: copies.cid })
    .from(copies)
    .innerJoin(objects, eq(objects.id, copies.objectID))
    .innerJoin(pages, eq(pages.id, objects.pageID))
    .where(and(eq(copies.protocol, ZET_COPY_PROTOCOL), eq(copies.uri, atUri)))
    .limit(1);
  return row ?? null;
}

export function zetDeps(env: Env): ZetDeps {
  const db = drizzle(env.DB);
  return {
    // global fetch を素で渡すと this が外れて Illegal invocation になる。
    getRecord: (rkey) =>
      fetchZetRecord(rkey, (input, init) => fetch(input, init)),
    findByAtUri: (atUri) => findZetByAtUri(db, atUri),
    putBody: async (bodyKey, body) => {
      const key = r2KeyOf(bodyKey);
      if (!key) throw new Error(`invalid bodyKey: ${bodyKey}`);
      await env.R2.put(key, body, {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });
    },
    create: async (input) => {
      await db.batch(zetCreateStatements(db, input));
      const [row] = await db
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.title, input.pageTitle))
        .limit(1);
      if (!row) {
        throw new Error(`page not found after insert: ${input.pageTitle}`);
      }
      return row.id;
    },
    update: async (input) => {
      await db.batch(zetUpdateStatements(db, input));
    },
    // Service Binding の fetch はホスト名を見ない。パスだけが ap に届く。
    publish: async (pageID, kind) => {
      await env.AP.fetch("https://ap.internal/internal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageID, kind }),
      });
    },
    purge: (paths) => purge(env, paths),
    newBodyKey: newSbBodyKey,
    now: () => new Date().toISOString(),
  };
}

export function handleZetPost(payload: unknown, env: Env): Promise<Response> {
  return ingestZet(payload, zetDeps(env));
}
