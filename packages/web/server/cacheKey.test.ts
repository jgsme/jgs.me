import { describe, expect, it } from "vitest";
import { cacheKeyFor } from "./cacheKey";

const V1 = "f8e3a1b2-0000-4000-8000-000000000001";
const V2 = "f8e3a1b2-0000-4000-8000-000000000002";

describe("cacheKeyFor", () => {
  it("デプロイのバージョンをクエリとして足す", () => {
    expect(cacheKeyFor("https://w.jgs.me/", V1)).toBe(
      `https://w.jgs.me/?__v=${V1}`,
    );
  });

  it("元のクエリを残す", () => {
    expect(cacheKeyFor("https://w.jgs.me/?p=2", V1)).toBe(
      `https://w.jgs.me/?p=2&__v=${V1}`,
    );
  });

  // これがこの関数の存在理由。デプロイでアセットのハッシュが変わっても、
  // 旧バージョンの HTML が別キーになるので配られ続けない。
  it("バージョンが違えば別のキーになる", () => {
    expect(cacheKeyFor("https://w.jgs.me/", V1)).not.toBe(
      cacheKeyFor("https://w.jgs.me/", V2),
    );
  });

  it("同じ URL と同じバージョンなら同じキー", () => {
    expect(cacheKeyFor("https://w.jgs.me/pages/foo", V1)).toBe(
      cacheKeyFor("https://w.jgs.me/pages/foo", V1),
    );
  });

  it("パスが違えば別のキーになる", () => {
    expect(cacheKeyFor("https://w.jgs.me/pages/a", V1)).not.toBe(
      cacheKeyFor("https://w.jgs.me/pages/b", V1),
    );
  });

  // version_metadata が無い環境 (ローカルの wrangler dev 等) でも
  // 例外を投げずにキーを作れること。
  it("バージョンが空文字でも壊れない", () => {
    expect(cacheKeyFor("https://w.jgs.me/", "")).toBe("https://w.jgs.me/?__v=");
  });
});
