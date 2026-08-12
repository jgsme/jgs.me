import { describe, expect, it } from "vitest";
import { RETRY_AFTER_FALLBACK_MS, parseRetryAfterMs } from "./rate-limit";

describe("parseRetryAfterMs", () => {
  it("body の retry_after (秒) をミリ秒にする", () => {
    expect(parseRetryAfterMs({ retry_after: 1.5 }, null)).toBe(1500);
  });

  it("body が無ければ Retry-After ヘッダ (秒) を使う", () => {
    expect(parseRetryAfterMs(null, "2")).toBe(2000);
  });

  it("body を優先する", () => {
    expect(parseRetryAfterMs({ retry_after: 0.25 }, "9")).toBe(250);
  });

  it("どちらも無ければ既定値を返す", () => {
    expect(parseRetryAfterMs(null, null)).toBe(RETRY_AFTER_FALLBACK_MS);
  });

  it("数値でない値は既定値に落とす", () => {
    expect(parseRetryAfterMs({ retry_after: "soon" }, null)).toBe(
      RETRY_AFTER_FALLBACK_MS,
    );
    expect(parseRetryAfterMs(null, "later")).toBe(RETRY_AFTER_FALLBACK_MS);
  });

  it("負の値は 0 に丸める", () => {
    expect(parseRetryAfterMs({ retry_after: -1 }, null)).toBe(0);
  });

  it("極端に長い待ちは上限で頭打ちにする", () => {
    expect(parseRetryAfterMs({ retry_after: 99999 }, null)).toBe(60000);
  });
});
