import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { articles, drafts, objects, pageLinks, pages } from "@jigsaw/db";
import { newSbBodyKey, r2KeyOf } from "@jigsaw/db/body-key";
import { newDraftKey } from "@jigsaw/db/draft";
import {
  createDraft,
  updateDraft,
  type DraftDeps,
  type DraftPublishInput,
} from "./draft";
import { extractLinks } from "./links";
import { buildMdPut } from "./mdBody";
import type { UpdateAction } from "./mf2update";
import { chunk } from "./rows";
import { objectIDOf, pageIDOf, type Batch, type DB } from "./zetStore";
import type { Env } from "./index";

// 下書きの公開: page + article + object (+ page_link) を入れ、draft 行を消す。
// 1 batch = 1 トランザクションなので、途中で落ちれば page も残らず draft も消えない。
// page_link は micropub.ts と同じ理由で 16 行ずつに刻む。
export function draftPublishStatements(
  db: DB,
  input: DraftPublishInput,
): Batch {
  const pageID = pageIDOf(input.title);
  return [
    // batch の結果から page.id を受け取る。commit 後に別の select を挟むと、
    // それが落ちたとき公開済みなのに putMd / notify に進めず 500 になる。
    db
      .insert(pages)
      .values({
        title: input.title,
        bodyKey: input.bodyKey,
        created: input.created,
        updated: input.created,
        image: input.image,
        spoiler: input.spoiler,
      })
      .returning({ id: pages.id }),
    db.insert(articles).values({
      pageID,
      created: input.created,
      date: input.date,
    }),
    db.insert(objects).values({
      id: objectIDOf(input.title),
      pageID,
      sourceProtocol: "web",
      mf2: input.mf2,
      deleted: false,
      created: input.created,
      updated: input.created,
    }),
    ...chunk(extractLinks(input.body), 16).map((group) =>
      db
        .insert(pageLinks)
        .values(group.map((toTitle) => ({ fromPageID: pageID, toTitle }))),
    ),
    db.delete(drafts).where(eq(drafts.id, input.draftID)),
  ];
}

export function draftDeps(env: Env): DraftDeps {
  const db = drizzle(env.DB);
  return {
    newKey: newDraftKey,
    newBodyKey: newSbBodyKey,
    now: () => new Date().toISOString(),
    putBody: async (bodyKey, body) => {
      const key = r2KeyOf(bodyKey);
      if (!key) throw new Error(`invalid bodyKey: ${bodyKey}`);
      await env.R2.put(key, body, {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });
    },
    insert: async (input) => {
      await db.insert(drafts).values({ ...input, updated: input.created });
    },
    findByKey: async (key) => {
      const [row] = await db
        .select({
          id: drafts.id,
          key: drafts.key,
          title: drafts.title,
          bodyKey: drafts.bodyKey,
          mf2: drafts.mf2,
        })
        .from(drafts)
        .where(eq(drafts.key, key))
        .limit(1);
      return row ?? null;
    },
    update: async (input) => {
      await db
        .update(drafts)
        .set({
          title: input.title,
          spoiler: input.spoiler,
          mf2: input.mf2,
          updated: input.updated,
        })
        .where(eq(drafts.id, input.id));
    },
    titleTaken: async (title) => {
      const [row] = await db
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.title, title))
        .limit(1);
      return row !== undefined;
    },
    publish: async (input) => {
      const results = await db.batch(draftPublishStatements(db, input));
      const first = results[0] as { id: number }[] | undefined;
      const id = first?.[0]?.id;
      if (typeof id !== "number") {
        throw new Error(`page id missing from publish batch: ${input.title}`);
      }
      return id;
    },
    // micropub.ts の putMd と同じ内容。micropub.ts が draftStore を import
    // するので、逆向きの import (循環) を避けてここで組む。
    putMd: async (bodyKey, body) => {
      const md = buildMdPut(bodyKey, body);
      if (!md) return;
      await env.MD.put(md.key, md.body, {
        httpMetadata: { contentType: md.contentType },
      });
    },
    // Service Binding の fetch はホスト名を見ない。パスだけが ap に届く。
    notify: async (pageID) => {
      await env.AP.fetch("https://ap.internal/internal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageID, kind: "create" }),
      });
    },
  };
}

export function handleDraftCreate(
  payload: unknown,
  env: Env,
): Promise<Response> {
  return createDraft(payload, draftDeps(env));
}

export function handleDraftUpdate(
  action: UpdateAction,
  key: string,
  env: Env,
): Promise<Response> {
  return updateDraft(action, key, draftDeps(env));
}
