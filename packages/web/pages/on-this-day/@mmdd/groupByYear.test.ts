import { describe, expect, it } from "vitest";
import { groupByYear } from "./groupByYear";

const a = (title: string, date: string) => ({ title, image: null, date });

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
});
