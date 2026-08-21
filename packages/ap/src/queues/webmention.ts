import type { Env, WebmentionMessage } from "../db";
import { processWebmention } from "../webmention";

export async function runWebmention(
  batch: MessageBatch<WebmentionMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processWebmention(msg.body, env);
      msg.ack();
    } catch (e) {
      console.error(`[webmention] error ${String(e)}`);
      msg.retry();
    }
  }
}
