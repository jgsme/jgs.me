import { describe, expect, it } from "vitest";
import { isSafeUrl, scrapboxToHtml } from "./scrapbox";

const SITE = "https://w.jgs.me";
const h = (text: string) => scrapboxToHtml(text, SITE);

describe("scrapboxToHtml", () => {
  it("最初の行 (タイトル行) を落とす", () => {
    expect(h("タイトル\n本文")).toBe("<p>本文</p>");
  });

  it("通常行を p で包む", () => {
    expect(h("t\nあいう\nかきく")).toBe("<p>あいう</p><p>かきく</p>");
  });

  it("空行は出力しない", () => {
    expect(h("t\nあ\n\nい")).toBe("<p>あ</p><p>い</p>");
  });

  it("内部リンクを自サイトの URL にする", () => {
    expect(h("t\n[別ページ]")).toBe(
      '<p><a href="https://w.jgs.me/pages/%E5%88%A5%E3%83%9A%E3%83%BC%E3%82%B8">別ページ</a></p>',
    );
  });

  it("外部リンクを表示名付きで出す", () => {
    expect(h("t\n[https://example.com れい]")).toBe(
      '<p><a href="https://example.com">れい</a></p>',
    );
  });

  it("表示名なしの外部リンクは URL をそのまま出す", () => {
    expect(h("t\n[https://example.com]")).toBe(
      '<p><a href="https://example.com">https://example.com</a></p>',
    );
  });

  it("強調を strong にする", () => {
    expect(h("t\n[* つよい]")).toBe("<p><strong>つよい</strong></p>");
  });

  it("斜体を em にする", () => {
    expect(h("t\n[/ ななめ]")).toBe("<p><em>ななめ</em></p>");
  });

  it("インラインコードを code にする", () => {
    expect(h("t\n`x = 1`")).toBe("<p><code>x = 1</code></p>");
  });

  it("コードブロックを pre code にする", () => {
    expect(h("t\ncode:js\n let a = 1\n let b = 2")).toBe(
      "<pre><code>let a = 1\nlet b = 2</code></pre>",
    );
  });

  it("インデント行を ul li にまとめる", () => {
    expect(h("t\n あ\n い")).toBe("<ul><li>あ</li><li>い</li></ul>");
  });

  it("HTML 特殊文字をエスケープする", () => {
    expect(h("t\n<script>&")).toBe("<p>&lt;script&gt;&amp;</p>");
  });

  it("リンクの表示名もエスケープする", () => {
    expect(h("t\n[https://example.com <b>]")).toBe(
      '<p><a href="https://example.com">&lt;b&gt;</a></p>',
    );
  });

  it("空文字なら空文字", () => {
    expect(h("")).toBe("");
  });

  it("タイトル行だけなら空文字", () => {
    expect(h("タイトルのみ")).toBe("");
  });

  it("画像を img にする", () => {
    expect(h("t\n[https://example.com/a.png]")).toBe(
      '<p><img src="https://example.com/a.png" alt=""></p>',
    );
  });

  it("強調画像 ([[url]]) も img にする", () => {
    expect(h("t\n[[https://example.com/a.png]]")).toBe(
      '<p><img src="https://example.com/a.png" alt=""></p>',
    );
  });

  it("ハッシュタグを自サイトへのリンクにする", () => {
    expect(h("t\n#タグ")).toBe(
      '<p><a href="https://w.jgs.me/pages/%E3%82%BF%E3%82%B0">#タグ</a></p>',
    );
  });

  it("[[太字]] も strong にする (strong ノード)", () => {
    expect(h("t\n[[太字]]")).toBe("<p><strong>太字</strong></p>");
  });

  it("番号リストは本文が消えず N. 中身のまま残る (numberList は raw を出す)", () => {
    expect(h("t\n 1. 項目")).toBe("<ul><li>1. 項目</li></ul>");
  });

  it("安全でない href はリンクにせずラベルのテキストとして残す", () => {
    // scrapbox-parser は http(s) 以外を pathType: absolute として拾わないため、
    // ここでは isSafeUrl を直接検証する
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,x")).toBe(false);
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });
});

const CARD =
  't\ncode:card\n {"url":"https://example.com/a","title":"タイトル","siteName":"example.com","image":"https://r2.jgs.me/x.png"}';

describe("code:card", () => {
  it("figure + img + figcaption にする", () => {
    expect(h(CARD)).toBe(
      '<figure><a href="https://example.com/a"><img src="https://r2.jgs.me/x.png" alt=""></a>' +
        '<figcaption><a href="https://example.com/a">タイトル</a> — example.com</figcaption></figure>',
    );
  });

  it("画像が無ければ img を省く", () => {
    const out = h('t\ncode:card\n {"url":"https://example.com/a","title":"T"}');
    expect(out).toBe(
      '<figure><figcaption><a href="https://example.com/a">T</a></figcaption></figure>',
    );
  });

  it("title が無ければ url を出す", () => {
    const out = h('t\ncode:card\n {"url":"https://example.com/a"}');
    expect(out).toContain(">https://example.com/a</a>");
  });

  it("壊れた card は普通のコードブロックとして出す", () => {
    expect(h("t\ncode:card\n これは JSON ではない")).toBe(
      "<pre><code>これは JSON ではない</code></pre>",
    );
  });
});
