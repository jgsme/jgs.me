import { describe, expect, it } from "vitest";
import { publishedKind } from "./published";

describe("publishedKind", () => {
  it("article の行があれば article", () => {
    expect(
      publishedKind({
        articleID: 1,
        clipID: null,
        zetRkey: null,
        druckID: null,
      }),
    ).toBe("article");
  });

  it("article と clip の両方があれば article を優先する", () => {
    expect(
      publishedKind({ articleID: 1, clipID: 2, zetRkey: null, druckID: null }),
    ).toBe("article");
  });

  it("clip だけなら clip", () => {
    expect(
      publishedKind({
        articleID: null,
        clipID: 2,
        zetRkey: null,
        druckID: null,
      }),
    ).toBe("clip");
  });

  it("zet だけなら zet", () => {
    expect(
      publishedKind({
        articleID: null,
        clipID: null,
        zetRkey: "3m2abcdefghij",
        druckID: null,
      }),
    ).toBe("zet");
  });

  it("druck だけなら druck", () => {
    expect(
      publishedKind({
        articleID: null,
        clipID: null,
        zetRkey: null,
        druckID: 4,
      }),
    ).toBe("druck");
  });

  it("どれも無ければ null (未公開)", () => {
    expect(
      publishedKind({
        articleID: null,
        clipID: null,
        zetRkey: null,
        druckID: null,
      }),
    ).toBeNull();
  });
});
