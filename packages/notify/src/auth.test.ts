import { describe, expect, it } from "vitest";
import { isAuthorized } from "./auth";

const SECRET = "s3cret-token";

describe("isAuthorized", () => {
  it("Bearer に正しいトークンが載っていれば通す", () => {
    expect(isAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("トークンが違えば弾く", () => {
    expect(isAuthorized("Bearer wrong-token", SECRET)).toBe(false);
  });

  it("同じ長さの別トークンでも弾く", () => {
    expect(isAuthorized("Bearer s3cret-tokeM", SECRET)).toBe(false);
  });

  it("Bearer prefix が無ければ弾く", () => {
    expect(isAuthorized(SECRET, SECRET)).toBe(false);
  });

  it("ヘッダが無ければ弾く", () => {
    expect(isAuthorized(null, SECRET)).toBe(false);
  });

  it("secret が未設定なら何を送っても弾く", () => {
    expect(isAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isAuthorized("Bearer ", undefined)).toBe(false);
  });

  it("secret が空文字なら何を送っても弾く", () => {
    expect(isAuthorized("Bearer ", "")).toBe(false);
    expect(isAuthorized("Bearer x", "")).toBe(false);
  });
});
