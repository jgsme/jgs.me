import { describe, expect, it } from "vitest";
import {
  HTML_ARTICLE_CLASS,
  RENDER_VERSION,
  derivedTextLines,
  parseRenderedHtmlArticle,
} from "./htmlArticle";

const valid = {
  version: 1,
  head: {
    links: [{ rel: "stylesheet", href: "https://example.com/a.css" }],
    styles: [{ css: "p{color:red}", media: null }],
  },
  body: '<div class="jgs-html-article"></div>',
};

describe("定数", () => {
  it("入れ物の class と版", () => {
    expect(HTML_ARTICLE_CLASS).toBe("jgs-html-article");
    expect(RENDER_VERSION).toBe(1);
  });
});

describe("parseRenderedHtmlArticle", () => {
  it("正しい形はそのまま返す", () => {
    expect(parseRenderedHtmlArticle(valid)).toEqual(valid);
  });
  it("version が違う数値でも形が合えば受け入れる", () => {
    expect(parseRenderedHtmlArticle({ ...valid, version: 99 })?.version).toBe(
      99,
    );
  });
  it("version が数値でなければ null", () => {
    expect(parseRenderedHtmlArticle({ ...valid, version: "1" })).toBeNull();
    const { version: _v, ...noVersion } = valid;
    expect(parseRenderedHtmlArticle(noVersion)).toBeNull();
  });
  it("body が文字列でなければ null", () => {
    expect(parseRenderedHtmlArticle({ ...valid, body: 1 })).toBeNull();
  });
  it("head の形が違えば null", () => {
    expect(parseRenderedHtmlArticle({ ...valid, head: null })).toBeNull();
    expect(parseRenderedHtmlArticle({ ...valid, head: {} })).toBeNull();
    expect(
      parseRenderedHtmlArticle({ ...valid, head: { links: "x", styles: [] } }),
    ).toBeNull();
    expect(
      parseRenderedHtmlArticle({ ...valid, head: { links: [], styles: {} } }),
    ).toBeNull();
  });
  it("links / styles の要素の形が違えば null", () => {
    expect(
      parseRenderedHtmlArticle({
        ...valid,
        head: { links: [{ rel: "stylesheet" }], styles: [] },
      }),
    ).toBeNull();
    expect(
      parseRenderedHtmlArticle({
        ...valid,
        head: { links: [{ rel: "icon", href: "x" }], styles: [] },
      }),
    ).toBeNull();
    expect(
      parseRenderedHtmlArticle({
        ...valid,
        head: { links: [], styles: [{ css: 1, media: null }] },
      }),
    ).toBeNull();
    expect(
      parseRenderedHtmlArticle({
        ...valid,
        head: { links: [], styles: [{ css: "a", media: 1 }] },
      }),
    ).toBeNull();
  });
  it("オブジェクトでなければ null", () => {
    expect(parseRenderedHtmlArticle(null)).toBeNull();
    expect(parseRenderedHtmlArticle(undefined)).toBeNull();
    expect(parseRenderedHtmlArticle("x")).toBeNull();
    expect(parseRenderedHtmlArticle(1)).toBeNull();
    expect(parseRenderedHtmlArticle([])).toBeNull();
  });
});

describe("derivedTextLines", () => {
  it("1行目 (題) を落とす", () => {
    expect(derivedTextLines("題\n本文")).toEqual(["本文"]);
  });
  it("空行と空白だけの行を落とす", () => {
    expect(derivedTextLines("題\na\n\n  \n\t\nb")).toEqual(["a", "b"]);
  });
  it("[x] #1 バッククォートはそのまま残す", () => {
    expect(derivedTextLines("題\n[x]\n#1\n`code`")).toEqual([
      "[x]",
      "#1",
      "`code`",
    ]);
  });
  it("空入力は []", () => {
    expect(derivedTextLines("")).toEqual([]);
  });
});
