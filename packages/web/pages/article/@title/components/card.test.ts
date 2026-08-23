import { describe, expect, it } from "vitest";
import { parseCardBlock } from "./card";

describe("parseCardBlock", () => {
  it("JSON 1 行を Card として読む", () => {
    const out = parseCardBlock('{"url":"https://example.com/a","title":"T"}');
    expect(out).toEqual({ url: "https://example.com/a", title: "T" });
  });

  it("前後の空白は無視する", () => {
    expect(parseCardBlock('  {"url":"https://example.com/a"}  ')?.url).toBe(
      "https://example.com/a",
    );
  });

  it("JSON として読めなければ null", () => {
    expect(parseCardBlock("これは JSON ではない")).toBeNull();
    expect(parseCardBlock("")).toBeNull();
  });

  it("url が無ければ null", () => {
    expect(parseCardBlock('{"title":"T"}')).toBeNull();
  });

  it("url が http / https でなければ null", () => {
    expect(parseCardBlock('{"url":"javascript:alert(1)"}')).toBeNull();
    expect(parseCardBlock('{"url":"ftp://example.com/a"}')).toBeNull();
  });

  it("配列や文字列は null", () => {
    expect(parseCardBlock('["https://example.com/a"]')).toBeNull();
    expect(parseCardBlock('"https://example.com/a"')).toBeNull();
  });

  it("文字列でないフィールドは落とす", () => {
    const out = parseCardBlock(
      '{"url":"https://example.com/a","title":123,"siteName":"s"}',
    );
    expect(out).toEqual({ url: "https://example.com/a", siteName: "s" });
  });

  it("image が http / https でなければ落とす (url は残す)", () => {
    const out = parseCardBlock(
      '{"url":"https://example.com/a","image":"javascript:x"}',
    );
    expect(out).toEqual({ url: "https://example.com/a" });
  });
});
