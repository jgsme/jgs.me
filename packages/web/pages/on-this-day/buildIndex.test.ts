import { describe, expect, it } from "vitest";
import { buildIndex } from "./buildIndex";

describe("buildIndex", () => {
  it("years を昇順に並べ entries を yearIndex で引けるようにする", () => {
    const got = buildIndex([
      { mmdd: "0401", year: 2024, count: 2 },
      { mmdd: "0401", year: 2022, count: 1 },
      { mmdd: "1231", year: 2024, count: 5 },
    ]);

    expect(got.years).toEqual([2022, 2024]);
    expect(got.entries["0401"]).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(got.entries["1231"]).toEqual([[1, 5]]);
  });

  it("entries は yearIndex の昇順に並ぶ", () => {
    const got = buildIndex([
      { mmdd: "0101", year: 2026, count: 1 },
      { mmdd: "0101", year: 2020, count: 1 },
    ]);
    expect(got.entries["0101"]).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("空なら空", () => {
    expect(buildIndex([])).toEqual({ years: [], entries: {} });
  });
});
