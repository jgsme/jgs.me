import { describe, expect, it } from "vitest";
import { toZetListItem } from "./zetView";

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
      href: `/pages/zet%3A${RKEY}`,
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
