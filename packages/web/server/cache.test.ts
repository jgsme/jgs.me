import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createCacheMiddleware } from "./cache";

// Workers の Cache API の最小実装。Request.url をキーにする
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    async match(req: Request) {
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req: Request, res: Response) {
      store.set(req.url, res);
    },
  };
}

// waitUntil に積まれた promise をテスト側で待てるようにする
function execCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (p: Promise<unknown>) => {
        pending.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext,
    settled: () => Promise.all(pending),
  };
}

const URL_UNDER_TEST = "https://w.jgs.me/pages/Re%3A%20test";
const ENV = { CF_VERSION_METADATA: { id: "v1" } };

describe("createCacheMiddleware", () => {
  let cache: ReturnType<typeof fakeCache>;

  beforeEach(() => {
    cache = fakeCache();
    (globalThis as { caches?: unknown }).caches = { default: cache };
  });

  function appWith(handler: (count: number) => Response) {
    const app = new Hono();
    let count = 0;
    app.use("/pages/*", createCacheMiddleware(86400));
    app.get("/pages/*", () => handler(++count));
    return { app, calls: () => count };
  }

  it("200 を焼いて 2 回目はオリジンに行かない", async () => {
    const { app, calls } = appWith(() => new Response("本体", { status: 200 }));
    const e = execCtx();

    const first = await app.request(URL_UNDER_TEST, {}, ENV, e.ctx);
    expect(first.status).toBe(200);
    await e.settled();

    const second = await app.request(URL_UNDER_TEST, {}, ENV, e.ctx);
    expect(second.status).toBe(200);
    expect(await second.text()).toBe("本体");
    expect(calls()).toBe(1);
  });

  // cacheKey は GET 固定なので、HEAD の応答をここに入れると
  // それが GET の答えとして返る。本番ではこれで記事ページが 404 に固定された
  it("HEAD の応答を GET のキャッシュに焼かない", async () => {
    const { app } = appWith(() => new Response("本体", { status: 200 }));
    const e = execCtx();

    await app.request(URL_UNDER_TEST, { method: "HEAD" }, ENV, e.ctx);
    await e.settled();

    expect(cache.store.size).toBe(0);
  });

  it("2xx でないレスポンスは焼かない", async () => {
    const { app } = appWith((count) =>
      count === 1
        ? new Response("こけた", { status: 500 })
        : new Response("本体", { status: 200 }),
    );
    const e = execCtx();

    const first = await app.request(URL_UNDER_TEST, {}, ENV, e.ctx);
    expect(first.status).toBe(500);
    await e.settled();

    const second = await app.request(URL_UNDER_TEST, {}, ENV, e.ctx);
    expect(second.status).toBe(200);
  });
});
