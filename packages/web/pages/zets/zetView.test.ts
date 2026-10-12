import { describe, expect, it } from "vitest";
import { toZetListItem, toZetTimeline } from "./zetView";

const RKEY = "3m2abcdefghij";

const row = (over: Partial<Parameters<typeof toZetListItem>[0]> = {}) => ({
  rkey: RKEY,
  title: null,
  date: "2026-10-11",
  image: null,
  excerpt: null,
  ...over,
});

describe("toZetListItem", () => {
  it("題があれば題を見出しにする", () => {
    expect(toZetListItem(row({ title: "朝の散歩" }))).toEqual({
      rkey: RKEY,
      href: `/pages/zet%3A${RKEY}`,
      heading: "朝の散歩",
      title: "朝の散歩",
      date: "2026-10-11",
      year: "2026",
      monthDay: "10/11",
      image: null,
      excerpt: null,
    });
  });

  it("題が無ければ日付を見出しにし、title は null", () => {
    const item = toZetListItem(row());
    expect(item.heading).toBe("2026-10-11");
    expect(item.title).toBeNull();
  });

  it("空白だけの題は題として扱わない", () => {
    expect(toZetListItem(row({ title: "  " })).title).toBeNull();
  });

  it("抜粋はそのまま持つ", () => {
    expect(toZetListItem(row({ excerpt: "test" })).excerpt).toBe("test");
  });

  it("空の抜粋 (画像だけの本文) は null にする", () => {
    expect(toZetListItem(row({ excerpt: "" })).excerpt).toBeNull();
  });
});

describe("toZetTimeline", () => {
  it("同じ日が続いたら 2 件目からは日付を出さない", () => {
    const items = toZetTimeline([
      row({ rkey: "a", date: "2026-10-12" }),
      row({ rkey: "b", date: "2026-10-12" }),
      row({ rkey: "c", date: "2026-10-11" }),
    ]);
    expect(items.map((z) => [z.rkey, z.showDate])).toEqual([
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
  });
});
