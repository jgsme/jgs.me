import { describe, expect, it } from "vitest";
import { MAX_GRAPHEMES, countGraphemes, truncateGraphemes } from "./text";

describe("countGraphemes", () => {
  it("ASCII を数える", () => {
    expect(countGraphemes("abc")).toBe(3);
  });

  it("日本語を数える", () => {
    expect(countGraphemes("あいう")).toBe(3);
  });

  it("絵文字を1つと数える (String.length は 2)", () => {
    expect("😀".length).toBe(2);
    expect(countGraphemes("😀")).toBe(1);
  });

  it("国旗を1つと数える (String.length は 4)", () => {
    expect("🇯🇵".length).toBe(4);
    expect(countGraphemes("🇯🇵")).toBe(1);
  });

  it("ZWJ で繋がった絵文字を1つと数える", () => {
    expect(countGraphemes("👨‍👩‍👧‍👦")).toBe(1);
  });

  it("空文字は 0", () => {
    expect(countGraphemes("")).toBe(0);
  });
});

describe("truncateGraphemes", () => {
  it("上限以下ならそのまま", () => {
    expect(truncateGraphemes("あいう", 5)).toEqual({
      text: "あいう",
      truncated: false,
    });
  });

  it("上限ちょうどならそのまま", () => {
    expect(truncateGraphemes("あいう", 3)).toEqual({
      text: "あいう",
      truncated: false,
    });
  });

  it("上限を超えたら切る", () => {
    expect(truncateGraphemes("あいうえお", 3)).toEqual({
      text: "あいう",
      truncated: true,
    });
  });

  it("絵文字の途中で切らない", () => {
    const r = truncateGraphemes("あ😀い", 2);
    expect(r.text).toBe("あ😀");
    expect(r.truncated).toBe(true);
  });

  it("国旗の途中で切らない", () => {
    const r = truncateGraphemes("🇯🇵🇺🇸", 1);
    expect(r.text).toBe("🇯🇵");
    expect(r.truncated).toBe(true);
  });

  it("上限は 300", () => {
    expect(MAX_GRAPHEMES).toBe(300);
  });
});
