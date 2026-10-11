import { describe, expect, it } from "vitest";
import { publishedKind } from "./published";

describe("publishedKind", () => {
  it("article の行があれば article", () => {
    expect(publishedKind({ articleID: 1, clipID: null, zetRkey: null })).toBe(
      "article",
    );
  });

  it("article と clip の両方があれば article を優先する", () => {
    expect(publishedKind({ articleID: 1, clipID: 2, zetRkey: null })).toBe(
      "article",
    );
  });

  it("clip だけなら clip", () => {
    expect(publishedKind({ articleID: null, clipID: 2, zetRkey: null })).toBe(
      "clip",
    );
  });

  it("zet だけなら zet", () => {
    expect(
      publishedKind({
        articleID: null,
        clipID: null,
        zetRkey: "3m2abcdefghij",
      }),
    ).toBe("zet");
  });

  it("どれも無ければ null (未公開)", () => {
    expect(
      publishedKind({ articleID: null, clipID: null, zetRkey: null }),
    ).toBeNull();
  });
});
