import type { Server } from "vike/types";
import { Hono } from "hono";
import vike from "@vikejs/hono";
import api from "./src/api";
import type { Env } from "./src/env";

const app = new Hono<{ Bindings: Env }>();

// id は内容の sha256。個別ページのキャッシュはこの形のパスにだけ付ける。
// `/:id` と書くと /health にも当たってしまう。
const ID_PATH = "/:id{[0-9a-f]{64}}";

// 個別ページのキャッシュ。行は消えうるので immutable にはしない。
// packages/web のように Cache API までは使わない。あちらには HEAD の応答を
// GET の答えとして焼いて 404 が固定された事故のコメントが残っている。
app.use(ID_PATH, async (c, next) => {
  await next();
  // 404 を焼くと、消しただけの id が max-age の間ずっと 404 のままになる。
  if (c.res.ok) c.res.headers.set("Cache-Control", "public, max-age=300");
});

app.route("/", api);

// 個別ページ (/:id) は pages/@id が受ける。vike は catch-all なので、
// これより後に登録したルートには到達しない。
vike(app);

export default { fetch: app.fetch } satisfies Server;
