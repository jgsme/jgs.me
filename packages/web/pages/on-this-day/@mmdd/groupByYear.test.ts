import { describe, expect, it } from "vitest";
import { groupByYear } from "./groupByYear";

// id はテスト内で同じ title を複数回 a() で参照しても一致するよう、
// title ごとに割り振って使い回す。
const ids = new Map<string, number>();
let nextId = 1;
const a = (title: string, date: string) => {
  if (!ids.has(title)) ids.set(title, nextId++);
  return { id: ids.get(title)!, title, image: null, date };
};

describe("groupByYear", () => {
  it("年ごとにまとめて新しい年から並べる", () => {
    const got = groupByYear([
      a("2022 の記事", "2022-04-01"),
      a("2024 の記事", "2024-04-01"),
      a("2022 のもう1本", "2022-04-01"),
    ]);

    expect(got).toEqual([
      { year: 2024, articles: [a("2024 の記事", "2024-04-01")] },
      {
        year: 2022,
        articles: [a("2022 の記事", "2022-04-01"), a("2022 のもう1本", "2022-04-01")],
      },
    ]);
  });

  it("空なら空", () => {
    expect(groupByYear([])).toEqual([]);
  });

  it("年内の順序は入力のまま保つ", () => {
    const got = groupByYear([a("先", "2022-04-01"), a("後", "2022-04-01")]);
    expect(got[0].articles.map((x) => x.title)).toEqual(["先", "後"]);
  });

  it("同じ title の記事でも id で区別できる", () => {
    // page.title に UNIQUE 制約が無いため、React key には id を使う。
    // groupByYear が id を落とさず保つことを確認する。
    const dup1 = { id: 101, title: "同じ題", image: null, date: "2022-04-01" };
    const dup2 = { id: 102, title: "同じ題", image: null, date: "2022-04-01" };
    const got = groupByYear([dup1, dup2]);
    expect(got[0].articles.map((x) => x.id)).toEqual([101, 102]);
  });
});
