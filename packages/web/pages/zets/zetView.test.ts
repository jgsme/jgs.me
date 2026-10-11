import { describe, expect, it } from "vitest";
import { toZetListItem, zetCanonical } from "./zetView";

const RKEY = "3m2abcdefghij";

describe("toZetListItem", () => {
  it("題があれば題を見出しにする", () => {
    expect(
      toZetListItem({
        rkey: RKEY,
        title: "朝の散歩",
        date: "2026-10-11",
        image: null,
      }),
    ).toEqual({
      rkey: RKEY,
      href: `/zets/${RKEY}`,
      heading: "朝の散歩",
      date: "2026-10-11",
      image: null,
    });
  });

  it("題が無ければ日付を見出しにする", () => {
    expect(
      toZetListItem({
        rkey: RKEY,
        title: null,
        date: "2026-10-11",
        image: null,
      }).heading,
    ).toBe("2026-10-11");
  });
});

describe("zetCanonical", () => {
  it("w.jgs.me の /zets/<rkey>", () => {
    expect(zetCanonical(RKEY)).toBe(`https://w.jgs.me/zets/${RKEY}`);
  });
});
