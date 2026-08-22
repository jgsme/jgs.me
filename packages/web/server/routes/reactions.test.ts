import { describe, expect, it } from "vitest";
import { parsePageID } from "./reactions";

describe("parsePageID", () => {
  it("十進の整数を数値にする", () => {
    expect(parsePageID("42")).toBe(42);
  });

  it("数値でないものは弾く", () => {
    expect(parsePageID("abc")).toBeNull();
  });

  // "12abc" は parseInt なら 12 を返してしまう。別ページの反応を引かせない。
  it("数字で始まるだけの文字列は弾く", () => {
    expect(parsePageID("12abc")).toBeNull();
  });

  it("空文字は弾く", () => {
    expect(parsePageID("")).toBeNull();
  });

  // pageID は AUTOINCREMENT。負数・0・小数は存在しない。
  it("0 以下と小数は弾く", () => {
    expect(parsePageID("0")).toBeNull();
    expect(parsePageID("-1")).toBeNull();
    expect(parsePageID("1.5")).toBeNull();
  });
});
