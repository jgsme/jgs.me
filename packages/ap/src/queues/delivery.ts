import type { DeliveryMessage, Env } from "../db";
import { importPrivateKey } from "../sig/keys";
import { deliver } from "../deliver";

// fetch ハンドラの CPU / subrequest 上限を避けるため、署名と配送はここで行う
// (spec §8)。Queue consumer の wall time は 15 分まで使える。
export async function runDelivery(
  batch: MessageBatch<DeliveryMessage>,
  env: Env,
): Promise<void> {
  let priv: CryptoKey;
  try {
    priv = await importPrivateKey(env.AP_PRIVATE_KEY);
  } catch (e) {
    // 鍵が読めないとバッチ全体が配送できない。
    // 例外のまま落とすと [deliver] の形でログに残らないので、ここで出す。
    console.error(
      `[deliver] key import failed size=${batch.messages.length} ${String(e)}`,
    );
    for (const msg of batch.messages) msg.retry();
    return;
  }

  for (const msg of batch.messages) {
    const { inbox, activity } = msg.body;
    try {
      const result = await deliver(inbox, activity, priv);
      if (result.ok) {
        console.log(
          `[deliver] ok inbox=${inbox} status=${result.status} variant=${result.variant}`,
        );
        msg.ack();
      } else {
        console.error(
          `[deliver] failed inbox=${inbox} status=${result.status} variant=${result.variant}`,
        );
        // 4xx は再送しても通らないので ack する。5xx だけ retry。
        if (result.status >= 400 && result.status < 500) {
          msg.ack();
        } else {
          msg.retry();
        }
      }
    } catch (e) {
      console.error(`[deliver] error inbox=${inbox} ${String(e)}`);
      msg.retry();
    }
  }
}
