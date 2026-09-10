import { copies } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { objectURI } from "../config";
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

  if (!perm.ok) {
    throw new Error(`permalink failed: ${perm.status} ${await perm.text()}`);
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
