import { eq } from "drizzle-orm";
import { articles, clips, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, shareURL } from "../config";
import { resolveContent } from "../content";
import { notifyDiscord } from "../notify";
import { buildContainerParams } from "./record";
import { requestContainer } from "./client";
import { withToken } from "./token";

// container を作って creation_id を返す。publish は別 queue が受け持つ。
// article だけでなく clip も配送対象 (bsky/post.ts と同じ理由)。
export async function createContainer(
  pageID: number,
  env: Env,
): Promise<string | null> {
  // wrangler.jsonc の THREADS_USER_ID は手動 OAuth の後に人が埋めるまで
  // 空文字。空のままだと URL が `/v1.0//threads` になって必ず失敗するので、
  // HTTP を叩く前に落として理由を通知する。retry しても直らない。
  if (!env.THREADS_USER_ID) {
    const msg = `Threads の THREADS_USER_ID が未設定なので container を作れない (pageID=${pageID})`;
    console.error(`[threads] ${msg}`);
    await notifyDiscord(env.DISCORD_REACTION_WEBHOOK, `${msg}。`);
    return null;
  }

  const db = getDB(env.DB);

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      bodyKey: pages.bodyKey,
      articleID: articles.id,
      clipID: clips.id,
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .leftJoin(clips, eq(clips.pageID, pages.id))
    .where(eq(pages.id, pageID))
    .limit(1);

  const page = rows[0];
  if (!page || (page.articleID === null && page.clipID === null)) {
    console.log(`[threads] page not found or not published pageID=${pageID}`);
    return null;
  }

  const html = await resolveContent(page.bodyKey, env.R2, SITE_URL, page.title);
  const params = buildContainerParams({ html, url: shareURL(page.id) });

  // resolveContent は R2 に本文が無いと "" を返す。TEXT 投稿は text 必須なので
  // 空のまま投げても弾かれるだけ。これも retry では直らない。
  if (params.text === "") {
    const msg = `Threads に投げる本文が空になった (pageID=${pageID})`;
    console.error(`[threads] ${msg}`);
    await notifyDiscord(env.DISCORD_REACTION_WEBHOOK, `${msg}。`);
    return null;
  }

  const res = await withToken(env, (token) =>
    requestContainer(token, env.THREADS_USER_ID, params),
  );

  if (!res.ok) {
    throw new Error(
      `createContainer failed: ${res.status} ${await res.text()}`,
    );
  }

  const out = (await res.json()) as { id: string };
  console.log(`[threads] container created pageID=${pageID} id=${out.id}`);
  return out.id;
}
