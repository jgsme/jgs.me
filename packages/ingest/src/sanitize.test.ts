import { describe, expect, it } from "vitest";
import { ALLOWED_ATTRS, ALLOWED_TAGS, DROP_WITH_CONTENT } from "./sanitize";

describe("ALLOWED_TAGS", () => {
  it("Mastodon v4.2 が通すタグを全て含む", () => {
    for (const tag of [
      "p", "span", "br", "a", "del", "pre", "code",
      "em", "strong", "b", "i", "u", "ul", "ol", "li", "blockquote",
    ]) {
      expect(ALLOWED_TAGS).toContain(tag);
    }
  });

  it("見出しを含む (Mastodon 側で p+strong に変換されるが自サイトでは活かす)", () => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(ALLOWED_TAGS).toContain(tag);
    }
  });

  it("画像とその周辺を含む", () => {
    for (const tag of ["img", "figure", "figcaption"]) {
      expect(ALLOWED_TAGS).toContain(tag);
    }
  });

  it("スクリプト実行につながるタグを含まない", () => {
    for (const tag of [
      "script", "style", "iframe", "object", "embed",
      "form", "input", "button", "link", "meta", "base", "svg",
    ]) {
      expect(ALLOWED_TAGS).not.toContain(tag);
    }
  });
});

describe("DROP_WITH_CONTENT", () => {
  it("中身のテキストごと落とすタグを含む", () => {
    for (const tag of [
      "script", "style", "iframe", "object", "embed",
      "svg", "math", "template", "noscript",
    ]) {
      expect(DROP_WITH_CONTENT).toContain(tag);
    }
  });

  it("許可タグと重ならない", () => {
    for (const tag of DROP_WITH_CONTENT) {
      expect(ALLOWED_TAGS).not.toContain(tag);
    }
  });
});

describe("ALLOWED_ATTRS", () => {
  it("a には href と title だけを許す", () => {
    expect(ALLOWED_ATTRS.a).toEqual(["href", "title"]);
  });

  it("img には src と alt と title だけを許す", () => {
    expect(ALLOWED_ATTRS.img).toEqual(["src", "alt", "title"]);
  });

  it("どのタグにも on* を許さない", () => {
    for (const attrs of Object.values(ALLOWED_ATTRS)) {
      for (const a of attrs) {
        expect(a.startsWith("on")).toBe(false);
      }
    }
  });

  it("どのタグにも style を許さない", () => {
    for (const attrs of Object.values(ALLOWED_ATTRS)) {
      expect(attrs).not.toContain("style");
    }
  });
});
