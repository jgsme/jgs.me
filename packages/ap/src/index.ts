import { Hono } from "hono";
import type { DeliveryMessage, Env, WebmentionMessage } from "./db";
import { webfinger } from "./routes/webfinger";
import { actor } from "./routes/actor";
import { nodeinfo } from "./routes/nodeinfo";
import { inbox } from "./routes/inbox";
import { objectRoute } from "./routes/object";
import { publish } from "./routes/publish";
import { webmention } from "./routes/webmention";
import { runDelivery } from "./queues/delivery";
import { runWebmention } from "./queues/webmention";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text("ok"));
app.route("/", webfinger);
app.route("/", actor);
app.route("/", nodeinfo);
app.route("/", inbox);
app.route("/", objectRoute);
app.route("/", publish);
app.route("/", webmention);

export default {
  fetch: app.fetch,

  // 後続計画が Queue を足す (計画7 ap-wm-send / 計画8 ap-bsky)。
  // 振り分けだけをここに置き、処理本体は src/queues/ に分ける。
  // 新しい Queue を足すときは case を1行と consumer ファイルを1本追加する。
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    switch (batch.queue) {
      case "ap-delivery":
        return runDelivery(batch as MessageBatch<DeliveryMessage>, env);
      case "ap-webmention":
        return runWebmention(batch as MessageBatch<WebmentionMessage>, env);
      default:
        // 知らない Queue から来たメッセージは retry せず落とす。
        // 設定ミスで無限に再試行させない。
        console.error(`[queue] unknown queue=${batch.queue}`);
        for (const msg of batch.messages) msg.ack();
    }
  },
};
