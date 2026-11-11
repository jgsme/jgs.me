import { describe, expect, it } from "vitest";
import {
  assertNotDraft,
  payloadPostStatus,
  readPostStatus,
  stripPostStatus,
} from "./postStatus";

describe("readPostStatus", () => {
  it("無ければ null", () => {
    expect(readPostStatus({})).toBeNull();
  });

  it("配列の先頭と素の値を読む", () => {
    expect(readPostStatus({ "post-status": ["draft"] })).toBe("draft");
    expect(readPostStatus({ "post-status": "published" })).toBe("published");
  });

  it("読めない値は投げる", () => {
    expect(() => readPostStatus({ "post-status": ["private"] })).toThrow(
      "post-status must be draft or published",
    );
    expect(() => readPostStatus({ "post-status": [] })).toThrow();
  });
});

describe("payloadPostStatus", () => {
  it("properties から読む", () => {
    expect(
      payloadPostStatus({
        type: ["h-entry"],
        properties: { "post-status": ["draft"] },
      }),
    ).toBe("draft");
  });

  it("payload がオブジェクトでなければ null", () => {
    expect(payloadPostStatus(null)).toBeNull();
  });
});

describe("stripPostStatus", () => {
  it("post-status だけ除く", () => {
    expect(stripPostStatus({ name: ["a"], "post-status": ["draft"] })).toEqual({
      name: ["a"],
    });
  });
});

describe("assertNotDraft", () => {
  it("draft は投げる", () => {
    expect(() => assertNotDraft({ "post-status": ["draft"] })).toThrow(
      "cannot go back to draft",
    );
  });

  it("published と未指定は通る", () => {
    expect(() =>
      assertNotDraft({ "post-status": ["published"] }),
    ).not.toThrow();
    expect(() => assertNotDraft({})).not.toThrow();
  });
});
