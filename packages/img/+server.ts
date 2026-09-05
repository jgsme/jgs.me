import type { Server } from "vike/types";
import { Hono } from "hono";
import vike from "@vikejs/hono";
import api from "./src/api";
import { cacheMiddleware, ID_PATH } from "./src/cache";
import type { Env } from "./src/env";

const app = new Hono<{ Bindings: Env }>();

app.use(ID_PATH, cacheMiddleware);
app.route("/", api);

// 個別ページ (/:id) は pages/@id が受ける。vike は catch-all なので、
// これより後に登録したルートには到達しない。
vike(app);

export default { fetch: app.fetch } satisfies Server;
