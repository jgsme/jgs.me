import { describe, expect, it } from "vitest";
import { draftPath, isDraftKey, isDraftPath, newDraftKey } from "./draft";

describe("newDraftKey / isDraftKey", () => {
  it("newDraftKey は 43 文字の base64url で、毎回違う", () => {
    const a = newDraftKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newDraftKey()).not.toBe(a);
  });
  it("isDraftKey は長さと文字種を見る", () => {
    expect(isDraftKey(newDraftKey())).toBe(true);
    expect(isDraftKey("abc")).toBe(false);
    expect(isDraftKey("a".repeat(42) + "/")).toBe(false);
    expect(isDraftKey("a".repeat(44))).toBe(false);
  });
});

describe("draftPath / isDraftPath", () => {
  it("draftPath / isDraftPath", () => {
    expect(draftPath("K")).toBe("/drafts/K");
    expect(isDraftPath("/drafts/K")).toBe(true);
    expect(isDraftPath("/drafts")).toBe(true);
    expect(isDraftPath("/draftsx")).toBe(false);
    expect(isDraftPath("/pages/drafts")).toBe(false);
  });
});
