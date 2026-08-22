import { describe, expect, it } from "vitest";
import {
  MAX_GRAPHEMES,
  countGraphemes,
  htmlToText,
  truncateGraphemes,
} from "./text";

describe("htmlToText", () => {
  it("タグを落とす", () => {
    expect(htmlToText("<p>あいう</p>")).toBe("あいう");
  });

  it("段落を改行2つに変える", () => {
    expect(htmlToText("<p>あ</p><p>い</p>")).toBe("あ\n\nい");
  });

  it("br を改行に変える", () => {
    expect(htmlToText("<p>あ<br>い</p>")).toBe("あ\nい");
  });

  it("li を改行区切りにする", () => {
    expect(htmlToText("<ul><li>あ</li><li>い</li></ul>")).toBe("あ\nい");
  });

  it("HTML エンティティを戻す", () => {
    expect(htmlToText("<p>&lt;tag&gt; &amp; &quot;q&quot;</p>")).toBe(
      '<tag> & "q"',
    );
  });

  it("&nbsp; を通常の空白にする", () => {
    expect(htmlToText("<p>あ&nbsp;い</p>")).toBe("あ い");
  });

  it("3つ以上の連続改行を2つに畳む", () => {
    expect(htmlToText("<p>あ</p><p></p><p></p><p>い</p>")).toBe("あ\n\nい");
  });

  it("前後の空白を落とす", () => {
    expect(htmlToText("  <p>あ</p>  ")).toBe("あ");
  });
});

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
