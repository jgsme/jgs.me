import type { Context, Next } from "hono";
import type { Bindings } from "./types";
import { cacheKeyFor } from "./cacheKey";

declare global {
  interface CacheStorage {
    default: Cache;
  }
}

export const createCacheMiddleware = (maxAge: number) => {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const url = new URL(c.req.url);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      await next();
      return;
    }

    // cacheKey の method は GET 固定なので、GET 以外をここに通すと
    // その応答が GET の答えとして焼かれる。実際 HEAD が 404 を返しており、
    // クローラーの HEAD が先に届いた記事は s-maxage の間 404 に固定されていた
    if (c.req.method !== "GET") {
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

    // 2xx だけ焼く。D1 や R2 が一時的にコケて出た 404 / 5xx を焼くと、
    // 直った後も s-maxage が切れるまでそのページが死ぬ
    if (!c.res.ok) return;

    c.header("Cache-Control", `s-maxage=${maxAge}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
  };
};
