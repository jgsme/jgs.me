import { describe, expect, it } from "vitest";
import { parse } from "@progfay/scrapbox-parser";
import type { Block } from "@progfay/scrapbox-parser";
import { isHorizontalRule } from "./horizontalRule";

// parse の 1 ブロック目は title なので、本文は 2 行目以降に置く。
function lineBlock(text: string): Block {
  const blocks = parse(`題\n${text}`);
  return blocks[1];
}

describe("isHorizontalRule", () => {
  it("--- だけの行は水平線", () => {
    expect(isHorizontalRule(lineBlock("---"))).toBe(true);
  });

  it("---- は水平線にしない", () => {
    expect(isHorizontalRule(lineBlock("----"))).toBe(false);
  });

  it("-- は水平線にしない", () => {
    expect(isHorizontalRule(lineBlock("--"))).toBe(false);
  });

  it("前後に文字がある --- は水平線にしない", () => {
    expect(isHorizontalRule(lineBlock("foo---"))).toBe(false);
  });

  it("インデントされた --- は水平線にしない", () => {
    expect(isHorizontalRule(lineBlock(" ---"))).toBe(false);
  });

  it("空行は水平線にしない", () => {
    expect(isHorizontalRule(lineBlock(""))).toBe(false);
  });

  it("line 以外のブロックは水平線にしない", () => {
    expect(isHorizontalRule(parse("---")[0])).toBe(false);
  });
});
