import { Hono } from "hono";
import { apply, serve } from "@photonjs/hono";
import type { Bindings } from "./types";
import { createCacheMiddleware } from "./cache";
import { headAsGet } from "./head";
import { redirects } from "./routes/redirects";
import { rss } from "./routes/rss";
import { robots } from "./routes/robots";
import { wellknown } from "./routes/wellknown";
import { objects } from "./routes/objects";
import { reactions } from "./routes/reactions";
import { internal } from "./routes/internal";

export type { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

// vike のハンドラは GET でしか登録されていないので、全ルートの手前で
// 下流に GET として見せる (server/head.ts)
app.use("*", headAsGet);

app.use("/", createCacheMiddleware(86400));
app.use("/pages/*", createCacheMiddleware(86400));
app.use("/a/*", createCacheMiddleware(604800));
app.use("/p/*", createCacheMiddleware(604800));

app.route("/", redirects);
app.route("/", rss);
app.route("/", robots);
app.route("/", wellknown);
app.route("/", objects);
app.route("/", reactions);
app.route("/", internal);

apply(app);
export default serve(app);
