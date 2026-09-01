import { describe, expect, it } from "vitest";
import {
  MAX_TITLE_LENGTH,
  decodeEntities,
  pickSourceTitle,
} from "./mf2extract";

const SRC = "https://ex.com/posts/1";

describe("pickSourceTitle", () => {
  it("h-entry の p-name を最優先する", () => {
    expect(pickSourceTitle("記事名", "記事名 - サイト名", SRC)).toBe("記事名");
  });

  // <title> はサイト名がぶら下がる形が多い。mf2 があるならそちらが正確。
  it("p-name が無ければ <title>", () => {
    expect(pickSourceTitle(null, "記事名 - サイト名", SRC)).toBe(
      "記事名 - サイト名",
    );
  });

  it("どちらも無ければホスト名", () => {
    expect(pickSourceTitle(null, null, SRC)).toBe("ex.com");
  });

  it("空白だけの p-name は無いものとして扱う", () => {
    expect(pickSourceTitle("   ", "記事名", SRC)).toBe("記事名");
  });

  it("空白だけの <title> も無いものとして扱う", () => {
    expect(pickSourceTitle(null, " \n ", SRC)).toBe("ex.com");
  });

  // 外部由来の文字列をそのまま DB に入れない。
  it("長すぎるタイトルは切り詰める", () => {
    const long = "あ".repeat(MAX_TITLE_LENGTH + 50);
    expect(pickSourceTitle(long, null, SRC)).toHaveLength(MAX_TITLE_LENGTH);
  });

  it("URL として読めなければ URL 文字列をそのまま返す", () => {
    expect(pickSourceTitle(null, null, "not a url")).toBe("not a url");
  });
});

// HTMLRewriter の text チャンクは実体参照を解かずに渡してくる。
// 素通しすると題も著者名も "A &amp; B" のまま DB に入って、そのまま表示される。
describe("decodeEntities", () => {
  it("名前付き実体を解く", () => {
    expect(decodeEntities("A &amp; B")).toBe("A & B");
    expect(decodeEntities("&lt;tag&gt;")).toBe("<tag>");
    expect(decodeEntities("&quot;q&quot;")).toBe('"q"');
    expect(decodeEntities("it&apos;s")).toBe("it's");
  });

  it("&nbsp; は U+00A0", () => {
    expect(decodeEntities("a&nbsp;b")).toBe("a\u00a0b");
  });

  it("10 進の数値参照を解く", () => {
    expect(decodeEntities("&#39;")).toBe("'");
  });

  it("16 進の数値参照を解く", () => {
    expect(decodeEntities("&#x2014;")).toBe("\u2014");
    expect(decodeEntities("&#X2014;")).toBe("\u2014");
  });

  // 一覧に無い実体を勝手に消さない。壊すより残すほうがマシ。
  it("知らない実体はそのまま残す", () => {
    expect(decodeEntities("&zwnj;x")).toBe("&zwnj;x");
  });

  it("範囲外の符号位置はそのまま残す", () => {
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("&#999999999;")).toBe("&#999999999;");
  });

  // 一度しか解かない。&amp;lt; は &lt; であって < ではない。
  it("二重には解かない", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });

  it("実体が無ければそのまま", () => {
    expect(decodeEntities("plain text")).toBe("plain text");
  });
});
