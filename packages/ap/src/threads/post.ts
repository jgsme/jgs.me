import { eq } from "drizzle-orm";
import { articles, clips, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, shareURL } from "../config";
import { resolveContent } from "../content";
import { buildContainerParams } from "./record";
import { requestContainer } from "./client";
import { withToken } from "./token";

// container を作って creation_id を返す。publish は別 queue が受け持つ。
// article だけでなく clip も配送対象 (bsky/post.ts と同じ理由)。
export async function createContainer(
  pageID: number,
  env: Env,
): Promise<string | null> {
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
