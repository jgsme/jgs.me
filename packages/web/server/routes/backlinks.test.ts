import { describe, expect, it } from "vitest";
import { parseOffset } from "./backlinks";

describe("parseOffset", () => {
  it("十進の整数を数値にする", () => {
    expect(parseOffset("24")).toBe(24);
  });

  // 1 ページ目は offset を付けずに叩ける。
  it("未指定は 0", () => {
    expect(parseOffset(undefined)).toBe(0);
  });

  it("0 を通す", () => {
    expect(parseOffset("0")).toBe(0);
  });

  // "24abc" は parseInt なら 24 を返してしまう。壊れた入力は黙って通さない。
  it("数字で始まるだけの文字列は弾く", () => {
    expect(parseOffset("24abc")).toBeNull();
  });

  it("数値でないものは弾く", () => {
    expect(parseOffset("abc")).toBeNull();
  });

  it("空文字は弾く", () => {
    expect(parseOffset("")).toBeNull();
  });

  it("負数と小数は弾く", () => {
    expect(parseOffset("-1")).toBeNull();
    expect(parseOffset("1.5")).toBeNull();
  });

  // 巨大な offset は D1 に無駄な走査をさせるだけ。被リンクの実測最大は 75 件で、
  // 上限に張り付く題は存在しない。
  it("上限を超えたら弾く", () => {
    expect(parseOffset("1000")).toBeNull();
  });
});
