import { describe, expect, it } from "vitest";
import { parse } from "@progfay/scrapbox-parser";
import { decoClassName, decoLevel, isDecoBleedLine } from "./deco";

describe("decoLevel", () => {
  it("* の段を数で返す", () => {
    expect(decoLevel(["*-1"])).toBe(1);
    expect(decoLevel(["/", "*-10"])).toBe(10);
  });
  it("* が無ければ null", () => {
    expect(decoLevel(["/", "-"])).toBeNull();
    expect(decoLevel([])).toBeNull();
  });
});

describe("decoClassName", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("%i 段目", (n) => {
    expect(decoClassName(n)).toBe(
      `text-deco-${n}-mobile md:text-deco-${n} wrap-anywhere`,
    );
  });
  it("範囲の外は空", () => {
    expect(decoClassName(0)).toBe("");
    expect(decoClassName(11)).toBe("");
  });
});

const line = (text: string) => {
  const block = parse(`title\n${text}`)[1];
  if (!block) throw new Error("block expected");
  return block;
};

describe("isDecoBleedLine", () => {
  it.each([
    "[******* 七]",
    "[******** 八]",
    "[********* 九]",
    "[********** 十]",
  ])("%s は広げる", (text) => expect(isDecoBleedLine(line(text))).toBe(true));
  it("他の装飾と重なっていても広げる", () => {
    expect(isDecoBleedLine(line("[*******/ 七]"))).toBe(true);
  });
  it.each([
    ["6 段目", "[****** 六]"],
    ["インデントされた行", " [******* 七]"],
    ["前に文がある", "前 [******* 七]"],
    ["後ろに文がある", "[******* 七] 後"],
    ["引用の中", "> [******* 七]"],
    ["埋め込みを含む", "[******* [https://www.youtube.com/watch?v=abc123]]"],
    ["画像を含む", "[******* [https://example.com/a.png]]"],
    ["強調の無い行", "ただの行"],
  ])("%s は広げない", (_, text) => {
    expect(isDecoBleedLine(line(text))).toBe(false);
  });
});
