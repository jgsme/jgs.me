import type { Env, ThreadsPublishMessage } from "../db";
import { finalizePost } from "../threads/finalize";

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
        `[threads] publish error pageID=${msg.body.pageID} ${String(e)}`,
      );
      msg.retry();
    }
  }
}
