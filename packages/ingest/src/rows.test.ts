import { describe, expect, it } from "vitest";
import { chunk, parseRows } from "./rows";

describe("parseRows", () => {
  it("正しい行を通す", () => {
    const rows = parseRows({
      rows: [{ pageID: 1, relatedPageID: 2, score: 0.7, adjusted: 0.1 }],
    });
    expect(rows).toEqual([
      { pageID: 1, relatedPageID: 2, score: 0.7, adjusted: 0.1 },
    ]);
  });

  it("rows が配列でなければ throw する", () => {
    expect(() => parseRows({ rows: "nope" })).toThrow();
    expect(() => parseRows({})).toThrow();
  });

  it("整数でない pageID を弾く", () => {
    expect(() =>
      parseRows({
        rows: [{ pageID: 1.5, relatedPageID: 2, score: 0.7, adjusted: 0.1 }],
      }),
    ).toThrow();
  });

  it("有限でない score を弾く", () => {
    expect(() =>
      parseRows({
        rows: [{ pageID: 1, relatedPageID: 2, score: NaN, adjusted: 0.1 }],
      }),
    ).toThrow();
  });

  it("自己参照を弾く", () => {
    expect(() =>
      parseRows({
        rows: [{ pageID: 1, relatedPageID: 1, score: 0.7, adjusted: 0.1 }],
      }),
    ).toThrow();
  });
});

describe("chunk", () => {
  it("指定サイズで割る", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("空配列は空を返す", () => {
    expect(chunk([], 2)).toEqual([]);
  });

  it("size より短ければ 1 個にまとまる", () => {
    expect(chunk([1], 16)).toEqual([[1]]);
  });
});
