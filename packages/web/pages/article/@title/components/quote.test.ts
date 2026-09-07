import { describe, expect, it } from "vitest";
import type { Node } from "@progfay/scrapbox-parser";
import { quoteText, quoteTier } from "./quote";

const plain = (text: string): Node => ({ type: "plain", raw: text, text });

const quote = (nodes: Node[]): Node => ({
  type: "quote",
  raw: `> ${nodes.map((n) => n.raw).join("")}`,
  nodes,
});

describe("quoteText", () => {
  it("plain を連結する", () => {
    expect(quoteText(quote([plain("あい"), plain("うえお")]))).toBe("あいうえお");
  });

  it("link は表示される文字だけ数える", () => {
    // href は画面に出ないので長さに含めない。content が空のときは href が出る。
    const withContent: Node = {
      type: "link",
      raw: "[https://example.com/very/long/path ラベル]",
      pathType: "absolute",
      href: "https://example.com/very/long/path",
      content: "ラベル",
    };
    const withoutContent: Node = {
      type: "link",
      raw: "[/pages/題]",
      pathType: "relative",
      href: "題",
      content: "",
    };
    expect(quoteText(quote([withContent]))).toBe("ラベル");
    expect(quoteText(quote([withoutContent]))).toBe("題");
  });

  it("入れ子の strong / decoration の中も辿る", () => {
    const strong: Node = {
      type: "strong",
      raw: "[[太い]]",
      nodes: [plain("太い")],
    };
    const deco: Node = {
      type: "decoration",
      raw: "[! 飾り]",
      rawDecos: "!",
      decos: ["!"],
      nodes: [plain("飾り")],
    };
    expect(quoteText(quote([strong, plain("と"), deco]))).toBe("太いと飾り");
  });

  it("text を持つ node (code / helpfeel) も数える", () => {
    const code: Node = { type: "code", raw: "`x = 1`", text: "x = 1" };
    expect(quoteText(quote([code]))).toBe("x = 1");
  });

  it("画像や数式は文字を持たないので 0 文字", () => {
    const image: Node = {
      type: "image",
      raw: "[https://example.com/a.png]",
      src: "https://example.com/a.png",
      link: "",
    };
    expect(quoteText(quote([image]))).toBe("");
  });

  it("前後の空白は落とす", () => {
    expect(quoteText(quote([plain("  あい  ")]))).toBe("あい");
  });
});

describe("quoteTier", () => {
  // 直近の clip 300 件を実測した分布 (min 13 / p25 28 / median 55 / p75 110 / max 288)
  // に合わせて 30 と 100 で切る。short 約 1/4・medium 約 1/2・long 約 1/4 に割れる。
  it("30 文字以下は short", () => {
    expect(quoteTier(quote([plain("あ".repeat(1))]))).toBe("short");
    expect(quoteTier(quote([plain("あ".repeat(30))]))).toBe("short");
  });

  it("31〜100 文字は medium", () => {
    expect(quoteTier(quote([plain("あ".repeat(31))]))).toBe("medium");
    expect(quoteTier(quote([plain("あ".repeat(100))]))).toBe("medium");
  });

  it("101 文字以上は long", () => {
    expect(quoteTier(quote([plain("あ".repeat(101))]))).toBe("long");
    expect(quoteTier(quote([plain("あ".repeat(288))]))).toBe("long");
  });

  it("空の引用は short に倒す", () => {
    expect(quoteTier(quote([]))).toBe("short");
  });

  it("サロゲートペアを 1 文字として数える", () => {
    // "𠮷" は UTF-16 で 2 単位。String.length で数えると 30 文字ちょうどの
    // 引用が medium に落ちる。
    expect(quoteTier(quote([plain("𠮷".repeat(30))]))).toBe("short");
  });
});
