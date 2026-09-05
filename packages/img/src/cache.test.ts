import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { cacheMiddleware, ID_PATH } from "./cache";

const ID = "a".repeat(64);

function app() {
  const a = new Hono();
  a.use(ID_PATH, cacheMiddleware);
  a.get("/health", (c) => c.text("ok"));
  a.get(`/${ID}`, (c) => c.html("<p>ok</p>"));
  a.get(`/${"b".repeat(64)}`, (c) => c.notFound());
  a.get(`/${"c".repeat(64)}`, (c) => c.redirect("/elsewhere"));
  // fetch 由来の Response はヘッダが immutable。c.res.headers.set だと落ちる。
  a.get(`/${"d".repeat(64)}`, () => {
    const r = new Response("ok", { status: 200 });
    Object.defineProperty(r.headers, "set", {
      value: () => {
        throw new TypeError("immutable");
      },
    });
    return r;
  });
  return a;
}

const cc = (res: Response) => res.headers.get("cache-control");

describe("cacheMiddleware", () => {
  it("個別ページには 5 分のキャッシュを付ける", async () => {
    expect(cc(await app().request(`/${ID}`))).toBe("public, max-age=300");
  });

  // 404 を焼くと、消しただけの id が max-age の間ずっと 404 のままになる。
  it("404 には付けない", async () => {
    expect(cc(await app().request(`/${"b".repeat(64)}`))).toBeNull();
  });

  it("リダイレクトには付けない", async () => {
    expect(cc(await app().request(`/${"c".repeat(64)}`))).toBeNull();
  });

  // ヘッダが immutable な Response でも落ちてはいけない。
  it("immutable なヘッダの Response でも 200 のまま付く", async () => {
    const res = await app().request(`/${"d".repeat(64)}`);
    expect(res.status).toBe(200);
    expect(cc(res)).toBe("public, max-age=300");
  });
});

describe("ID_PATH", () => {
  // `/:id` と書くと /health や /api/images にも当たってしまう。
  it("/health には当たらない", async () => {
    const res = await app().request("/health");
    expect(res.status).toBe(200);
    expect(cc(res)).toBeNull();
  });

  it("64 桁 hex 以外には当たらない", async () => {
    const a = app();
    a.get("/notahash", (c) => c.text("x"));
    a.get(`/${"A".repeat(64)}`, (c) => c.text("x"));
    expect(cc(await a.request("/notahash"))).toBeNull();
    expect(cc(await a.request(`/${"A".repeat(64)}`))).toBeNull();
  });
});
