import { describe, expect, it } from "vitest";
import { robots } from "./robots";

describe("GET /robots.txt", () => {
  it("text/plain で 200 を返す", async () => {
    const res = await robots.request("/robots.txt");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("全クローラに全体を許可する", async () => {
    const res = await robots.request("/robots.txt");
    const body = await res.text();

    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
  });

  // /search はクエリ次第で URL が無限に増える。中身は既存ページの再掲なので
  // クロールさせても新しく見つかるものが無い。
  it("検索ページはクロールさせない", async () => {
    const res = await robots.request("/robots.txt");
    const body = await res.text();

    expect(body).toContain("Disallow: /search");
  });

  it("末尾は改行で終わる", async () => {
    const res = await robots.request("/robots.txt");
    const body = await res.text();

    expect(body.endsWith("\n")).toBe(true);
  });
});
