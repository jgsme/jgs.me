import { describe, expect, it } from "vitest";
import { druckPageLinks, toDruckList } from "./druckView";

describe("toDruckList", () => {
  it("各項目は pagePath(title) に飛び、渡された順を保つ", () => {
    const items = toDruckList([
      { id: 2, title: "新しい druck", image: null },
      { id: 1, title: "古い/druck", image: "https://r2.jgs.me/x.png" },
    ]);
    expect(items).toEqual([
      {
        id: 2,
        title: "新しい druck",
        href: "/pages/%E6%96%B0%E3%81%97%E3%81%84%20druck",
        image: null,
      },
      {
        id: 1,
        title: "古い/druck",
        href: "/pages/%E5%8F%A4%E3%81%84%2Fdruck",
        image: "https://r2.jgs.me/x.png",
      },
    ]);
  });
});

describe("druckPageLinks", () => {
  it("1 ページ目は前が無い", () => {
    expect(druckPageLinks(1, true)).toEqual({
      prev: null,
      next: "/drucks?p=2",
    });
  });

  it("2 ページ目の前は /drucks (?p=1 を作らない)", () => {
    expect(druckPageLinks(2, true)).toEqual({
      prev: "/drucks",
      next: "/drucks?p=3",
    });
  });

  it("3 ページ目以降は前後とも ?p=N", () => {
    expect(druckPageLinks(3, false)).toEqual({
      prev: "/drucks?p=2",
      next: null,
    });
  });
});
