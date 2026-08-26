import { describe, expect, it } from "vitest";
import { buildArticleBody } from "./articleBody";

const lineTexts = (blocks: ReturnType<typeof buildArticleBody>["blocks"]) =>
  blocks
    .filter((b) => b.type === "line")
    .map((b) => (b.type === "line" ? b.nodes.map((n) => n.raw).join("") : ""));

describe("buildArticleBody", () => {
  it("1行目 (題) を落として本文の先頭行は残す", () => {
    const out = buildArticleBody("題\n本文の1行目\n本文の2行目");
    expect(lineTexts(out.blocks)).toEqual(["本文の1行目", "本文の2行目"]);
  });

  it("from [YYYYMMDD] から日付を拾い、その行を落とす", () => {
    const out = buildArticleBody("題\nfrom [20240102]\n\n本文");
    expect(out.fromDate).toBe("2024-01-02");
    expect(lineTexts(out.blocks)).toEqual(["本文"]);
  });

  it("末尾の #YYYYMMDD から日付を拾い、その行を落とす", () => {
    const out = buildArticleBody("題\n本文\n#20240102");
    expect(out.fromDate).toBe("2024-01-02");
    expect(lineTexts(out.blocks)).toEqual(["本文"]);
  });

  it("日付が無ければ fromDate は null", () => {
    expect(buildArticleBody("題\n本文").fromDate).toBeNull();
  });

  it("無効な日付タグの上に有効なものがあれば、値を取った行のほうを落とす", () => {
    // extractBodyDate は無効な #20241332 を飛ばして #20240102 を採る。
    // 行除去がこれと食い違うと、値の出どころが本文に残ってしまう。
    const out = buildArticleBody("題\n本文\n#20240102\n#20241332");
    expect(out.fromDate).toBe("2024-01-02");
    expect(lineTexts(out.blocks)).toEqual(["本文", "#20241332"]);
  });

  it("末尾タグが無効なだけなら日付は null で、その行は本文に残る", () => {
    // 日付として読めないタグはただのハッシュタグ。本文の一部として残す。
    const out = buildArticleBody("題\n本文\n#20241332");
    expect(out.fromDate).toBeNull();
    expect(lineTexts(out.blocks)).toEqual(["本文", "#20241332"]);
  });

  it("description は本文から作り 200 文字で切る", () => {
    const out = buildArticleBody(`題\n${"あ".repeat(300)}`);
    expect(out.description.length).toBe(200);
  });
});
