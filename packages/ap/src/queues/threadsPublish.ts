import type { Env, ThreadsPublishMessage } from "../db";
import { notifyDiscord } from "../notify";
import { finalizePost } from "../threads/finalize";

// wrangler.jsonc の ap-threads-publish consumer の max_retries と揃える。
// 片方だけ変えると最終試行の判定がずれて通知が出なくなるので、必ず両方直す。
const MAX_RETRIES = 3;

export async function runThreadsPublish(
  batch: MessageBatch<ThreadsPublishMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await finalizePost(msg.body.pageID, msg.body.creationID, env);
      msg.ack();
    } catch (e) {
      console.error(
        `[threads] publish error pageID=${msg.body.pageID} attempt=${msg.attempts} ${String(e)}`,
      );
      // attempts は 1 始まりで、初回 + retry を数える。DLQ が無いので
      // 最終試行 (MAX_RETRIES + 1 回目) で落ちた分は黙って消える。
      // 消える前に必ず知らせる。
      if (msg.attempts > MAX_RETRIES) {
        await notifyDiscord(
          env.DISCORD_REACTION_WEBHOOK,
          `Threads への publish が retry を使い切った (pageID=${msg.body.pageID}, creationID=${msg.body.creationID}): ${String(e)}`,
        );
      }
      msg.retry();
    }
  }
}
