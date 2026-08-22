import type { BskyMessage, Env } from "../db";
import { postToBsky } from "../bsky/post";

export async function runBsky(
  batch: MessageBatch<BskyMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await postToBsky(msg.body.pageID, env);
      msg.ack();
    } catch (e) {
      console.error(`[bsky] error pageID=${msg.body.pageID} ${String(e)}`);
      msg.retry();
    }
  }
}
