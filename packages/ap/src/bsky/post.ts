import { eq } from "drizzle-orm";
import { articles, copies, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, USER_AGENT, articleURL, objectURI } from "../config";
import { resolveContent } from "../content";
import { buildPostRecord } from "./record";
import { uploadOgThumb } from "./blob";
import { ENTRYWAY, getSession, invalidateSession } from "./session";

const CREATE_RECORD = `${ENTRYWAY}/xrpc/com.atproto.repo.createRecord`;

function createRecord(
  accessJwt: string,
  repo: string,
  record: Record<string, unknown>,
): Promise<Response> {
  return fetch(CREATE_RECORD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      repo,
      collection: "app.bsky.feed.post",
      record,
    }),
  });
}

// 記事は「自サイトへのリンク」として流す。
// 本文の画像は blob 化しない (ATProto の text は inline 画像を持てない)。
export async function postToBsky(pageID: number, env: Env): Promise<void> {
  const db = getDB(env.DB);

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      created: pages.created,
      updated: pages.updated,
      bodyKey: pages.bodyKey,
    })
    .from(pages)
    .innerJoin(articles, eq(articles.pageID, pages.id))
    .where(eq(pages.id, pageID))
    .limit(1);

  const page = rows[0];
  if (!page) {
    console.log(`[bsky] page not found or not published pageID=${pageID}`);
    return;
  }

  const html = await resolveContent(page.bodyKey, env.R2, SITE_URL, page.title);
  const url = articleURL(page.title);
  const thumb = await uploadOgThumb(pageID, env);

  const record = buildPostRecord({
    title: page.title,
    created: page.created,
    html,
    url,
    thumb,
  });

  const session = await getSession(env);
  let res = await createRecord(session.accessJwt, session.did, record);

  // トークンが切れていたらキャッシュを捨てて1度だけやり直す。
  if (res.status === 401) {
    await invalidateSession(env);
    const fresh = await getSession(env);
    res = await createRecord(fresh.accessJwt, fresh.did, record);
  }

  if (!res.ok) {
    throw new Error(`createRecord failed: ${res.status} ${await res.text()}`);
  }

  // output は required: ["uri", "cid"]。
  // PDS が計算した CID をそのまま保存する。自分で計算する必要がない。
  const out = (await res.json()) as { uri: string; cid: string };

  await db
    .insert(copies)
    .values({
      objectID: objectURI(pageID),
      protocol: "atproto",
      uri: out.uri,
      cid: out.cid,
    })
    .onConflictDoUpdate({
      target: [copies.objectID, copies.protocol],
      set: { uri: out.uri, cid: out.cid },
    });

  console.log(`[bsky] posted pageID=${pageID} uri=${out.uri} cid=${out.cid}`);
}
