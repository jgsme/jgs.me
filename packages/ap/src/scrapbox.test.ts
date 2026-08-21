import { describe, expect, it } from "vitest";
import { scrapboxToHtml } from "./scrapbox";

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
});
