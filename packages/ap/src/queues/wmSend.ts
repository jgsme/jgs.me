import type { Env, SendMessage } from "../db";
import { sendWebmention } from "../send";

export async function runWmSend(
  batch: MessageBatch<SendMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await sendWebmention(msg.body);
      msg.ack();
    } catch (e) {
      console.error(`[wm-send] error ${String(e)}`);
      msg.retry();
    }
  }
}
