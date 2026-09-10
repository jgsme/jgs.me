import { copies } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { objectURI } from "../config";
import { notifyDiscord } from "../notify";
import { requestPermalink, requestPublish } from "./client";
import { withToken } from "./token";

// container を公開し、permalink を copies に残す。
export async function finalizePost(
  pageID: number,
  creationID: string,
  env: Env,
): Promise<void> {
  const pub = await withToken(env, (token) =>
    requestPublish(token, env.THREADS_USER_ID, creationID),
  );

  if (!pub.ok) {
    throw new Error(`publish failed: ${pub.status} ${await pub.text()}`);
  }

  const published = (await pub.json()) as { id: string };

  // permalink は media id から導出できないので取りに行く。
  const perm = await withToken(env, (token) =>
    requestPermalink(token, published.id),
  );

  // ここまで来た時点で投稿は公開済み。permalink が取れなくても throw しない
  // ようにする: retry すると同じ creation_id で publish をやり直すことになり、
  // creation_id が使い捨てだという未確認の前提が外れていれば二重投稿になる。
  // 取り逃した permalink は通知に media id を載せて人が手で拾う。
  if (!perm.ok) {
    const body = await perm.text();
    console.error(
      `[threads] permalink failed pageID=${pageID} mediaID=${published.id} status=${perm.status} ${body}`,
    );
    await notifyDiscord(
      env.DISCORD_REACTION_WEBHOOK,
      `Threads への投稿は済んだが permalink を取れなかった (pageID=${pageID}, media id=${published.id}, ${perm.status})。copies に残っていないので手で入れる必要がある。`,
    );
    return;
  }

  const meta = (await perm.json()) as { permalink: string };

  // copies は (objectID, protocol) の複合主キー。cid は ATProto 固有なので
  // Threads では埋めない。
  const db = getDB(env.DB);
  await db
    .insert(copies)
    .values({
      objectID: objectURI(pageID),
      protocol: "threads",
      uri: meta.permalink,
      cid: null,
    })
    .onConflictDoUpdate({
      target: [copies.objectID, copies.protocol],
      set: { uri: meta.permalink, cid: null },
    });

  console.log(`[threads] posted pageID=${pageID} permalink=${meta.permalink}`);
}
