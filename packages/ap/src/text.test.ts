import { describe, expect, it } from "vitest";
import { htmlToText } from "./text";

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
