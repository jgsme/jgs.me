import { describe, expect, it } from "vitest";
import { shareUrlPath } from "./shareUrl";

describe("shareUrlPath", () => {
  it("article なら /a/:id を返す", () => {
    expect(shareUrlPath({ articleId: 12, clipId: null, zetId: null })).toBe(
      "/a/12",
    );
  });

  it("clip なら /c/:id を返す", () => {
    expect(shareUrlPath({ articleId: null, clipId: 34, zetId: null })).toBe(
      "/c/34",
    );
  });

  // ingest の isClip で排他になるはずだが、壊れた時に article を優先する。
  it("両方あるときは article を優先する", () => {
    expect(shareUrlPath({ articleId: 12, clipId: 34, zetId: null })).toBe(
      "/a/12",
    );
  });

  it("zet なら /z/:id を返す", () => {
    expect(shareUrlPath({ articleId: null, clipId: null, zetId: 56 })).toBe(
      "/z/56",
    );
  });

  it("article / clip があれば zet より優先する", () => {
    expect(shareUrlPath({ articleId: 12, clipId: null, zetId: 56 })).toBe(
      "/a/12",
    );
    expect(shareUrlPath({ articleId: null, clipId: 34, zetId: 56 })).toBe(
      "/c/34",
    );
  });

  it("どれでもないページは null", () => {
    expect(
      shareUrlPath({ articleId: null, clipId: null, zetId: null }),
    ).toBeNull();
  });
});
