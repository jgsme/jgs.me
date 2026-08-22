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
      // どの source からのどの target が落ちたかを残す。これが無いと
      // DLQ を引くまで対象が分からない。
      console.error(
        `[webmention] error source=${msg.body.source} target=${msg.body.target} ${String(e)}`,
      );
      msg.retry();
    }
  }
}
