import { describe, expect, it } from "vitest";
import { scopeCss, scopeSelectorList } from "./scopeCss";

const S = ".jgs-html-article";

describe("scopeSelectorList", () => {
  it.each([
    [":root", S],
    ["html", S],
    ["body", S],
    ["html body", S],
    ["html.dark .card", `${S}.dark .card`],
    [":root[data-theme=dark]", `${S}[data-theme=dark]`],
    ["body > main", `${S} > main`],
    ["*", `${S} *`],
    ["h1", `${S} h1`],
    [".a .b", `${S} .a .b`],
    ["p::before", `${S} p::before`],
    ["::selection", `${S} ::selection`],
    ["a:hover", `${S} a:hover`],
    ["h1, h2 , .lead", `${S} h1, ${S} h2, ${S} .lead`],
    ["body,html", `${S}, ${S}`],
    ['a[title="x,y"]', `${S} a[title="x,y"]`],
    [":is(h1, h2) span", `${S} :is(h1, h2) span`],
    ["bodyguard", `${S} bodyguard`],
    ["#html", `${S} #html`],
  ])("%s → %s", (input, expected) => {
    expect(scopeSelectorList(input, S)).toBe(expected);
  });
});

describe("scopeCss", () => {
  it(":root の変数", () => {
    expect(scopeCss(":root{--x:#fff;--y:1px}", S)).toBe(
      `${S}{--x:#fff;--y:1px}`,
    );
  });

  it("prefers-color-scheme の中の :root", () => {
    expect(
      scopeCss("@media (prefers-color-scheme: dark){:root{--bg:#000}}", S),
    ).toBe(`@media (prefers-color-scheme: dark){${S}{--bg:#000}}`);
  });

  it("*{box-sizing} / html{scroll-behavior} / body{…}", () => {
    expect(
      scopeCss(
        "*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font:16px/1.7 sans-serif}",
        S,
      ),
    ).toBe(
      `${S} *{box-sizing:border-box}${S}{scroll-behavior:smooth}${S}{margin:0;font:16px/1.7 sans-serif}`,
    );
  });

  it("@media(max-width) の入れ子", () => {
    expect(
      scopeCss(
        "@media(max-width:600px){.grid{display:block}@supports (gap:1rem){.grid{gap:1rem}}}",
        S,
      ),
    ).toBe(
      `@media(max-width:600px){${S} .grid{display:block}@supports (gap:1rem){${S} .grid{gap:1rem}}}`,
    );
  });

  it("@font-face / @keyframes / @import はそのまま", () => {
    const css =
      '@import url("https://fonts.googleapis.com/css2?family=Inter");@font-face{font-family:X;src:url(x.woff2)}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}';
    expect(scopeCss(css, S)).toBe(css);
  });

  it("文字列とコメントの中の { } と , は数えない", () => {
    expect(scopeCss('/* a{b} */.q::after{content:"}{,"}', S)).toBe(
      `/* a{b} */${S} .q::after{content:"}{,"}`,
    );
  });

  it("宣言ブロックの中の入れ子はそのまま", () => {
    expect(scopeCss(".card{color:red;&:hover{color:blue}}", S)).toBe(
      `${S} .card{color:red;&:hover{color:blue}}`,
    );
  });

  it("釣り合わない括弧でも投げずに残りを出す", () => {
    expect(() => scopeCss(".a{color:red", S)).not.toThrow();
    expect(scopeCss(".a{color:red", S)).toContain("color:red");
  });

  // 整形された CSS の改行と字下げは保つ。差分を読むときに崩れていると追えない。
  it("規則の前後の空白は保つ", () => {
    expect(
      scopeCss("\n  body {\n    margin: 0;\n  }\n  h1 { x: y }\n", S),
    ).toBe(`\n  ${S} {\n    margin: 0;\n  }\n  ${S} h1 { x: y }\n`);
  });

  it("文の at-rule と @layer の宣言はそのまま、@layer のブロックは中を書き換える", () => {
    expect(scopeCss('@charset "utf-8";@layer a, b;@layer a{p{x:y}}', S)).toBe(
      `@charset "utf-8";@layer a, b;@layer a{${S} p{x:y}}`,
    );
  });

  it("ベンダー接頭辞付きの @keyframes もそのまま", () => {
    const css = "@-webkit-keyframes f{from{opacity:0}}";
    expect(scopeCss(css, S)).toBe(css);
  });
});
