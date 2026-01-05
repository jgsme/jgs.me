import { Hono } from "hono";
import { apply, serve } from "@photonjs/hono";
import type { Bindings } from "./types";
import { api } from "./routes/api";
import { redirects } from "./routes/redirects";
import { rss } from "./routes/rss";

export type { Bindings } from "./types";

declare global {
  interface CacheStorage {
    default: Cache;
  }
}

const app = new Hono<{ Bindings: Bindings }>();

const createCacheMiddleware = (maxAge: number) => {
  return async (
    c: Parameters<Parameters<typeof app.use>[1]>[0],
    next: () => Promise<void>,
  ) => {
    const url = new URL(c.req.url);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      await next();
      return;
    }

    const cache = caches.default;
    const cacheKey = new Request(c.req.url, { method: "GET" });

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

app.route("/api", api);
app.route("/", redirects);
app.route("/", rss);

apply(app);
export default serve(app);
