import { describe, expect, it } from "vitest";
import { isAuthorized } from "./auth";

describe("isAuthorized", () => {
  it("一致する Bearer を通す", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
  });

  it("一致しなければ弾く", () => {
    expect(isAuthorized("Bearer other", "secret")).toBe(false);
  });

  it("ヘッダが無ければ弾く", () => {
    expect(isAuthorized(null, "secret")).toBe(false);
  });

  it("Bearer 以外のスキームは弾く", () => {
    expect(isAuthorized("Basic secret", "secret")).toBe(false);
  });

  // 設定漏れが「全員通過」に化けるのを防ぐ。
  it("secret が未設定なら誰も通さない", () => {
    expect(isAuthorized("Bearer secret", undefined)).toBe(false);
    expect(isAuthorized("Bearer ", "")).toBe(false);
  });
});
