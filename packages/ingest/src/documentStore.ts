import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { copies, druck, objects, pages } from "@jigsaw/db";
import {
  htmlKeyOf,
  mdKeyOf,
  newHtmlBodyKey,
  r2KeyOf,
  renderKeyOf,
} from "@jigsaw/db/body-key";
import { DOCUMENT_COPY_PROTOCOL } from "@jigsaw/db/standard";
import { objectURI } from "./site";
import { purge } from "./purge";
import { fetchDocumentRecord } from "./documentRecord";
import { aiHtmlConverter } from "./htmlConvert";
import {
  ingestDocument,
  type DocumentBodies,
  type DocumentCreateInput,
  type DocumentDeps,
  type DocumentTarget,
  type DocumentUpdateInput,
} from "./document";
import { objectIDOf, pageIDOf, type Batch, type DB } from "./zetStore";
import type { Env } from "./index";

// page + druck + object + copy を 1 batch で入れる。batch は 1 回の D1 呼び出し
// かつトランザクションなので、途中で落ちれば何も残らない (zetStore.ts と同じ)。
// page_link は入れない。派生テキストは Scrapbox 記法ではない。
export function documentCreateStatements(
  db: DB,
  input: DocumentCreateInput,
): Batch {
  const pageID = pageIDOf(input.title);
  const objectID = objectIDOf(input.title);
  return [
    db.insert(pages).values({
      title: input.title,
      bodyKey: input.bodyKey,
      created: input.created,
      updated: input.updated,
      image: input.image,
      spoiler: input.spoiler,
    }),
    db.insert(druck).values({
      pageID,
      created: input.created,
      date: input.date,
    }),
    db.insert(objects).values({
      id: objectID,
      pageID,
      // 原本は PDS の record。mf2 は通知 (at-uri だけ) なので、Micropub の
      // q=source / update の土台にはならない (zet と同じ)。
      sourceProtocol: "atproto",
      atproto: input.atproto,
      mf2: input.mf2,
      deleted: false,
      created: input.created,
      updated: input.updated,
    }),
    db.insert(copies).values({
      objectID,
      protocol: DOCUMENT_COPY_PROTOCOL,
      uri: input.atUri,
      cid: input.cid,
    }),
  ];
}

export function documentUpdateStatements(
  db: DB,
  input: DocumentUpdateInput,
): Batch {
  const objectID = objectURI(input.pageID);
  return [
    // 題は record に従って書き換える。bodyKey は変えない (R2 のキーは
    // record の一生で不変)。
    db
      .update(pages)
      .set({
        title: input.title,
        image: input.image,
        spoiler: input.spoiler,
        updated: input.updated,
      })
      .where(eq(pages.id, input.pageID)),
    db
      .update(copies)
      .set({ cid: input.cid })
      .where(
        and(
          eq(copies.objectID, objectID),
          eq(copies.protocol, DOCUMENT_COPY_PROTOCOL),
        ),
      ),
    db
      .update(objects)
      .set({ atproto: input.atproto, mf2: input.mf2, updated: input.updated })
      .where(eq(objects.id, objectID)),
  ];
}

export async function findDocumentByAtUri(
  db: DB,
  atUri: string,
): Promise<DocumentTarget | null> {
  const [row] = await db
    .select({
      pageID: pages.id,
      druckID: druck.id,
      title: pages.title,
      bodyKey: pages.bodyKey,
      cid: copies.cid,
    })
    .from(copies)
    .innerJoin(objects, eq(objects.id, copies.objectID))
    .innerJoin(pages, eq(pages.id, objects.pageID))
    .innerJoin(druck, eq(druck.pageID, pages.id))
    .where(
      and(eq(copies.protocol, DOCUMENT_COPY_PROTOCOL), eq(copies.uri, atUri)),
    )
    .limit(1);
  return row ?? null;
}

async function findPageIDByTitle(db: DB, title: string) {
  const [row] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(eq(pages.title, title))
    .limit(1);
  return row?.id ?? null;
}

function keyOrThrow(key: string | null, bodyKey: string): string {
  if (!key) throw new Error(`invalid bodyKey: ${bodyKey}`);
  return key;
}

// 原本 → 組み直し → 派生テキスト → md の順に書く。web は組み直しを、検索・
// 日付解決は .sb を読む。原本は組み直しの規則を変えたときの作り直しに使う。
async function putBodies(
  env: Env,
  bodyKey: string,
  bodies: DocumentBodies,
): Promise<void> {
  await env.R2.put(keyOrThrow(htmlKeyOf(bodyKey), bodyKey), bodies.html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
  await env.R2.put(
    keyOrThrow(renderKeyOf(bodyKey), bodyKey),
    JSON.stringify(bodies.render),
    { httpMetadata: { contentType: "application/json" } },
  );
  await env.R2.put(keyOrThrow(r2KeyOf(bodyKey), bodyKey), bodies.sb, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
  await env.MD.put(keyOrThrow(mdKeyOf(bodyKey), bodyKey), bodies.md, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
  });
}

export function documentDeps(env: Env): DocumentDeps {
  const db = drizzle(env.DB);
  return {
    // global fetch を素で渡すと this が外れて Illegal invocation になる。
    getRecord: (rkey) =>
      fetchDocumentRecord(rkey, (input, init) => fetch(input, init)),
    findByAtUri: (atUri) => findDocumentByAtUri(db, atUri),
    findPageIDByTitle: (title) => findPageIDByTitle(db, title),
    convert: aiHtmlConverter(env.AI),
    putBodies: (bodyKey, bodies) => putBodies(env, bodyKey, bodies),
    create: async (input) => {
      await db.batch(documentCreateStatements(db, input));
      // batch は入れた行の id を返さないので、題で引き直す。
      const [row] = await db
        .select({ pageID: pages.id, druckID: druck.id })
        .from(pages)
        .innerJoin(druck, eq(druck.pageID, pages.id))
        .where(eq(pages.title, input.title))
        .limit(1);
      if (!row) throw new Error(`page not found after insert: ${input.title}`);
      return row;
    },
    update: async (input) => {
      await db.batch(documentUpdateStatements(db, input));
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
    newBodyKey: newHtmlBodyKey,
    now: () => new Date().toISOString(),
  };
}

export function handleDocumentPost(
  payload: unknown,
  env: Env,
): Promise<Response> {
  return ingestDocument(payload, documentDeps(env));
}
