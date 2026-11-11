import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DRAFT_HEADERS, draftHeadersMiddleware } from "./draftHeaders";

const app = new Hono();
app.use("/drafts/*", draftHeadersMiddleware);
app.get("/drafts/ok", (c) => c.text("ok"));
app.get("/drafts/missing", (c) => c.text("not found", 404));
app.get("/drafts/broken", () => {
  throw new Error("boom");
});
// fetch() 由来の応答のように headers が変更不可でも付くこと。
app.get("/drafts/immutable", () => Response.redirect("https://example.com/"));
app.get("/pages/x", (c) => c.text("page"));
app.onError((_, c) => c.text("error", 500));

describe("draftHeadersMiddleware", () => {
  it.each([
    ["/drafts/ok", 200],
    ["/drafts/missing", 404],
    ["/drafts/broken", 500],
    ["/drafts/immutable", 302],
  ])("%s (%i) に 3 つのヘッダが付く", async (path, status) => {
    const res = await app.request(path);
    expect(res.status).toBe(status);
    for (const [name, value] of Object.entries(DRAFT_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("/drafts/ の外には付かない", async () => {
    const res = await app.request("/pages/x");
    for (const name of Object.keys(DRAFT_HEADERS)) {
      expect(res.headers.get(name)).toBeNull();
    }
  });
});
