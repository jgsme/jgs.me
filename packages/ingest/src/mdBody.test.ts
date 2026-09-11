import { describe, expect, it } from "vitest";
import { buildMdPut, toMarkdown } from "./mdBody";

describe("toMarkdown", () => {
  it("1行目の題を h1 にする", () => {
    expect(toMarkdown("題\n本文")).toBe("# 題\n\n本文");
  });

  it("強調記法の行を h2 にする", () => {
    expect(toMarkdown("題\n[* 見出し]")).toBe("# 題\n\n## 見出し");
  });

  // リンク先の URL は落とす。日本語タイトルを URL エンコードすると本文の
  // 2割強が URL になり、埋め込みを薄める。ナビゲーションは web が原本から
  // レンダリングするので、検索用の派生物にリンク先は要らない。
  it("内部リンクはページ名だけ残す", () => {
    expect(toMarkdown("題\nあれは[ページ名]だ")).toBe(
      "# 題\n\nあれはページ名だ",
    );
  });

  it("外部リンクはリンクテキストだけ残す", () => {
    expect(toMarkdown("題\n[https://example.com/x タイトル]")).toBe(
      "# 題\n\nタイトル",
    );
  });

  it("リンクテキストの無い外部リンクは何も残さない", () => {
    expect(toMarkdown("題\n参考 [https://example.com/x]")).toBe(
      "# 題\n\n参考 ",
    );
  });

  it("ハッシュタグはそのまま残す", () => {
    expect(toMarkdown("題\n#タグ")).toBe("# 題\n\n#タグ");
  });

  // 画像 URL は検索に無価値なので落とす。
  it("画像は落として周りの本文は残す", () => {
    expect(toMarkdown("題\n前 [https://example.com/a.png] 後")).toBe(
      "# 題\n\n前  後",
    );
  });

  it("引用を md の引用にする", () => {
    expect(toMarkdown("題\n> 引用")).toBe("# 題\n\n> 引用");
  });

  // Scrapbox のインデントは箇条書き相当。実データでは 44% の行が付いている。
  it("インデント行を箇条書きにする", () => {
    expect(toMarkdown("題\n 一段目")).toBe("# 題\n\n- 一段目");
  });

  it("インデントの深さをネストにする", () => {
    expect(toMarkdown("題\n 一段目\n  二段目")).toBe(
      "# 題\n\n- 一段目\n  - 二段目",
    );
  });

  // 末尾の空行を残すと、本文の有無を呼び出し側が判定できない。
  it("末尾の空行を落とす", () => {
    expect(toMarkdown("題\n本文\n\n\n")).toBe("# 題\n\n本文");
  });

  it("本文が無ければ題だけ返す", () => {
    expect(toMarkdown("題\n")).toBe("# 題");
  });

  it("画像しか無い本文は題だけになる", () => {
    expect(toMarkdown("題\n[https://example.com/a.png]\n")).toBe("# 題");
  });

  it("本文中の空行は段落の区切りとして残す", () => {
    expect(toMarkdown("題\n段落1\n\n段落2")).toBe("# 題\n\n段落1\n\n段落2");
  });
});

// buildCreateR2Put と同じ理由でここを通す。handleMicropubCreate が
// env.MD.put に直接組み立てた値を渡すよう書き換わっても、この関数単体の
// テストでは検出できないが、配線をユニットテストで固定はできる。
describe("buildMdPut", () => {
  it("キーは .md、中身は md、MIME は text/markdown", () => {
    expect(buildMdPut("sb-0189abcd", "題\n本文")).toEqual({
      key: "sb-0189abcd.md",
      body: "# 題\n\n本文",
      contentType: "text/markdown; charset=utf-8",
    });
  });

  it("bodyKey が空なら null (本文が存在しない)", () => {
    expect(buildMdPut("", "題\n本文")).toBeNull();
  });
});

// clip の本文は 1 行目の題のあとにもう一度題が入っていることがある。
// 消した extractSnippet にも同じ除去があった (trimmed === title を落とす)。
describe("toMarkdown の題の重複", () => {
  it("本文に題と同じ行があれば落とす", () => {
    expect(toMarkdown("題\n題\n本文")).toBe("# 題\n\n本文");
  });

  it("前後の空白だけ違う行も題とみなす", () => {
    expect(toMarkdown("題\n  題  \n本文")).toBe("# 題\n\n本文");
  });

  it("題を含むだけの行は落とさない", () => {
    expect(toMarkdown("題\n題の話\n本文")).toBe("# 題\n\n題の話\n本文");
  });
});

// レンダリング側 (articleBody.ts) が表示から落としているものは、検索用の
// 本文にも要らない。
describe("toMarkdown の定型行の除去", () => {
  it("先頭の from [日付] 行を落とす", () => {
    expect(toMarkdown("題\nfrom [20260211] #0211\n本文")).toBe("# 題\n\n本文");
  });

  it("先頭でない from 行は落とさない", () => {
    expect(toMarkdown("題\n本文\nfrom [20260211]")).toBe(
      "# 題\n\n本文\nfrom 20260211",
    );
  });

  it("from に見えても日付でなければ落とさない", () => {
    expect(toMarkdown("題\nfrom [どこか]")).toBe("# 題\n\nfrom どこか");
  });

  // Scrapbox の空のインデント行。マーカーだけが残ってもノイズにしかならない。
  it("中身が空のインデント行を落とす", () => {
    expect(toMarkdown("題\n 一段目\n \n 二段目")).toBe(
      "# 題\n\n- 一段目\n- 二段目",
    );
  });
});
