import type { Env, ThreadsCreateMessage } from "../db";
import { createContainer } from "../threads/post";

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
        `[threads] create error pageID=${msg.body.pageID} ${String(e)}`,
      );
      msg.retry();
    }
  }
}
