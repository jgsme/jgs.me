import { describe, expect, it } from "vitest";
import { shareUrlPath } from "./shareUrl";

describe("shareUrlPath", () => {
  it("article なら /a/:id を返す", () => {
    expect(shareUrlPath({ articleId: 12, clipId: null })).toBe("/a/12");
  });

  it("clip なら /c/:id を返す", () => {
    expect(shareUrlPath({ articleId: null, clipId: 34 })).toBe("/c/34");
  });

  // ingest の isClip で排他になるはずだが、壊れた時に article を優先する。
  it("両方あるときは article を優先する", () => {
    expect(shareUrlPath({ articleId: 12, clipId: 34 })).toBe("/a/12");
  });

  it("どちらでもないページは null", () => {
    expect(shareUrlPath({ articleId: null, clipId: null })).toBeNull();
  });
});
