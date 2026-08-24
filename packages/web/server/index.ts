import { Hono } from "hono";
import type { Context, Next } from "hono";
import { apply, serve } from "@photonjs/hono";
import type { Bindings } from "./types";
import { redirects } from "./routes/redirects";
import { rss } from "./routes/rss";
import { robots } from "./routes/robots";
import { wellknown } from "./routes/wellknown";
import { objects } from "./routes/objects";
import { reactions } from "./routes/reactions";
import { internal } from "./routes/internal";
import { cacheKeyFor } from "./cacheKey";

export type { Bindings } from "./types";

declare global {
  interface CacheStorage {
    default: Cache;
  }
}

const app = new Hono<{ Bindings: Bindings }>();

const createCacheMiddleware = (maxAge: number) => {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const url = new URL(c.req.url);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      await next();
      return;
    }

    const cache = caches.default;
    // デプロイのバージョンを混ぜる。これが無いと、デプロイでアセットの
    // ハッシュが変わった後も古い HTML が配られ、そこが指すアセットは
    // 既に無いのでブラウザ側で 500 になる。
    const cacheKey = new Request(
      cacheKeyFor(c.req.url, c.env.CF_VERSION_METADATA.id),
      { method: "GET" },
    );

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    await next();

    c.header("Cache-Control", `s-maxage=${maxAge}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
  };
};

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
