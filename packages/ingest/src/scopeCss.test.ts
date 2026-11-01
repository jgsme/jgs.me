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

  // ブラウザは閉じていないブロックを末尾で閉じて読む。そのまま出すと枠に漏れる
  it("閉じていない規則も末尾まで閉じ込める", () => {
    expect(scopeCss("h1{x:y}body{margin:0;background:#000", S)).toBe(
      `${S} h1{x:y}${S}{margin:0;background:#000`,
    );
  });

  it("閉じていない @media の中も閉じ込める", () => {
    expect(scopeCss("@media (x){.a{b:c}\nbody{background:red}", S)).toBe(
      `@media (x){${S} .a{b:c}\n${S}{background:red}`,
    );
  });

  // 改行で切れた文字列はブラウザがそこで終わらせ、続きを規則として読む
  it("改行で終わる文字列の後ろの規則も閉じ込める", () => {
    expect(scopeCss('.a::after{content:"x\n}body{background:red}', S)).toBe(
      `${S} .a::after{content:"x\n}${S}{background:red}`,
    );
  });

  it("エスケープした改行は文字列の続き", () => {
    expect(scopeCss('.a::after{content:"x\\\n}"}body{}', S)).toBe(
      `${S} .a::after{content:"x\\\n}"}${S}{}`,
    );
  });

  it("@starting-style と知らない at-rule は中を書き換える", () => {
    expect(
      scopeCss("@starting-style{.card{opacity:0}}@foo{a{color:red}}", S),
    ).toBe(`@starting-style{${S} .card{opacity:0}}@foo{${S} a{color:red}}`);
  });

  it("@scope は前置きの根と境界を閉じ込め、中はそのまま", () => {
    expect(scopeCss("@scope (.card){img{x:y}}", S)).toBe(
      `@scope (${S} .card){img{x:y}}`,
    );
    expect(scopeCss("@scope (.a) to (.b){p{x:y}}", S)).toBe(
      `@scope (${S} .a) to (${S} .b){p{x:y}}`,
    );
  });

  it("剥がした body の擬似要素は入れ物に付く", () => {
    expect(scopeCss("body::before{}", S)).toBe(`${S}::before{}`);
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
    const css =
      "@-webkit-keyframes f{from{opacity:0}}@-moz-keyframes g{to{x:y}}";
    expect(scopeCss(css, S)).toBe(css);
  });
});
