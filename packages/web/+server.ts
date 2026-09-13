import type { Server } from "vike/types";
import { Hono } from "hono";
import vike from "@vikejs/hono";
import type { Bindings } from "./server/types";
import { createCacheMiddleware } from "./server/cache";
import { redirects } from "./server/routes/redirects";
import { rss } from "./server/routes/rss";
import { robots } from "./server/routes/robots";
import { random } from "./server/routes/random";
import { wellknown } from "./server/routes/wellknown";
import { objects } from "./server/routes/objects";
import { reactions } from "./server/routes/reactions";
import { backlinks } from "./server/routes/backlinks";
import { internal } from "./server/routes/internal";
import { suggest } from "./server/routes/suggest";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/", createCacheMiddleware(86400));
app.use("/pages/*", createCacheMiddleware(86400));
app.use("/a/*", createCacheMiddleware(604800));
app.use("/p/*", createCacheMiddleware(604800));
app.use("/c/*", createCacheMiddleware(604800));
// /clips は 1 ページ 20 件ぶん R2 GET が走るページ。トップからの導線が
// このブランチで初めて張られるので、/ と同じ TTL でキャッシュする。
app.use("/clips*", createCacheMiddleware(86400));
app.use("/on-this-day/*", createCacheMiddleware(86400));
// 検索サジェストは打鍵ごとに飛ぶ。同じ語は他人の打鍵とも重なるので、
// 短く焼くだけで D1 を引く回数がまとめて減る。
app.use("/api/search/suggest", createCacheMiddleware(300));

app.route("/", redirects);
app.route("/", rss);
app.route("/", robots);
app.route("/", random);
app.route("/", wellknown);
app.route("/", objects);
app.route("/", reactions);
app.route("/", backlinks);
app.route("/", internal);
app.route("/", suggest);

vike(app);

export default { fetch: app.fetch } satisfies Server;
