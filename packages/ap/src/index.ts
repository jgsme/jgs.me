import { Hono } from "hono";
import type {
  BskyMessage,
  DeliveryMessage,
  Env,
  SendMessage,
  ThreadsCreateMessage,
  ThreadsPublishMessage,
  WebmentionMessage,
} from "./db";
import { webfinger } from "./routes/webfinger";
import { actor } from "./routes/actor";
import { nodeinfo } from "./routes/nodeinfo";
import { inbox } from "./routes/inbox";
import { objectRoute } from "./routes/object";
import { publish } from "./routes/publish";
import { webmention } from "./routes/webmention";
import { runDelivery } from "./queues/delivery";
import { runWebmention } from "./queues/webmention";
import { runWmSend } from "./queues/wmSend";
import { runBsky } from "./queues/bsky";
import { runThreadsCreate } from "./queues/threadsCreate";
import { runThreadsPublish } from "./queues/threadsPublish";
import { refreshToken } from "./threads/token";

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

  // 振り分けだけをここに置き、処理本体は src/queues/ に分ける。
  // 新しい Queue を足すときは case を1行と consumer ファイルを1本追加する。
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    switch (batch.queue) {
      case "ap-delivery":
        return runDelivery(batch as MessageBatch<DeliveryMessage>, env);
      case "ap-webmention":
        return runWebmention(batch as MessageBatch<WebmentionMessage>, env);
      case "ap-wm-send":
        return runWmSend(batch as MessageBatch<SendMessage>, env);
      case "ap-bsky":
        return runBsky(batch as MessageBatch<BskyMessage>, env);
      case "ap-threads-create":
        return runThreadsCreate(
          batch as MessageBatch<ThreadsCreateMessage>,
          env,
        );
      case "ap-threads-publish":
        return runThreadsPublish(
          batch as MessageBatch<ThreadsPublishMessage>,
          env,
        );
      default:
        // 知らない Queue から来たメッセージは retry せず落とす。
        // 設定ミスで無限に再試行させない。
        console.error(`[queue] unknown queue=${batch.queue}`);
        for (const msg of batch.messages) msg.ack();
    }
  },

  // Threads の long-lived token は 60 日で失効し、失効すると手動 OAuth から
  // やり直しになる。週1で叩き直して期限を戻す。
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await refreshToken(env);
  },
};
