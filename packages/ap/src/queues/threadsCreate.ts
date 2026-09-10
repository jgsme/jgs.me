import type { Env, ThreadsCreateMessage } from "../db";
import { notifyDiscord } from "../notify";
import { createContainer } from "../threads/post";

// wrangler.jsonc の ap-threads-create consumer の max_retries と揃える。
// 片方だけ変えると最終試行の判定がずれて通知が出なくなるので、必ず両方直す。
const MAX_RETRIES = 3;

export async function runThreadsCreate(
  batch: MessageBatch<ThreadsCreateMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const creationID = await createContainer(msg.body.pageID, env);
      // 未公開の page は container を作らない。retry しても変わらない。
      if (creationID) {
        // 公式は container 作成後に平均 30 秒待つよう指示している。
        // TEXT は media 処理が無いので即時に通る見込みだが保証は無い。
        await env.THREADS_PUBLISH.send(
          { pageID: msg.body.pageID, creationID },
          { delaySeconds: 30 },
        );
      }
      msg.ack();
    } catch (e) {
      console.error(
        `[threads] create error pageID=${msg.body.pageID} attempt=${msg.attempts} ${String(e)}`,
      );
      // attempts は 1 始まりで、初回 + retry を数える。DLQ が無いので
      // 最終試行 (MAX_RETRIES + 1 回目) で落ちた分は黙って消える。
      // 消える前に必ず知らせる。
      if (msg.attempts > MAX_RETRIES) {
        await notifyDiscord(
          env.DISCORD_REACTION_WEBHOOK,
          `Threads の container 作成が retry を使い切った (pageID=${msg.body.pageID}): ${String(e)}`,
        );
      }
      msg.retry();
    }
  }
}
