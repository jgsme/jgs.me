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
    expect(out.fromDate).toBe("2024/01/02");
    expect(lineTexts(out.blocks)).toEqual(["本文"]);
  });

  it("末尾の #YYYYMMDD から日付を拾い、その行を落とす", () => {
    const out = buildArticleBody("題\n本文\n#20240102");
    expect(out.fromDate).toBe("2024/01/02");
    expect(lineTexts(out.blocks)).toEqual(["本文"]);
  });

  it("日付が無ければ fromDate は null", () => {
    expect(buildArticleBody("題\n本文").fromDate).toBeNull();
  });

  it("description は本文から作り 200 文字で切る", () => {
    const out = buildArticleBody(`題\n${"あ".repeat(300)}`);
    expect(out.description.length).toBe(200);
  });
});
