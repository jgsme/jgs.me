import { describe, expect, it } from "vitest";
import { parseLinkHeader } from "./discovery";

describe("parseLinkHeader", () => {
  it("rel=webmention の href を取る", () => {
    expect(parseLinkHeader('<https://ex.com/wm>; rel="webmention"')).toBe(
      "https://ex.com/wm",
    );
  });

  it("引用符なしの rel でも取る", () => {
    expect(parseLinkHeader("<https://ex.com/wm>; rel=webmention")).toBe(
      "https://ex.com/wm",
    );
  });

  it("複数の rel 値に混ざっていても取る", () => {
    expect(
      parseLinkHeader('<https://ex.com/wm>; rel="something webmention"'),
    ).toBe("https://ex.com/wm");
  });

  it("複数の Link が並んでいたら最初の webmention を取る", () => {
    expect(
      parseLinkHeader(
        '<https://ex.com/a>; rel="canonical", <https://ex.com/wm>; rel="webmention"',
      ),
    ).toBe("https://ex.com/wm");
  });

  it("相対 URL もそのまま返す (解決は呼び出し側)", () => {
    expect(parseLinkHeader('</wm>; rel="webmention"')).toBe("/wm");
  });

  it("空の href も返す (仕様上は自分自身を意味する)", () => {
    expect(parseLinkHeader('<>; rel="webmention"')).toBe("");
  });

  it("webmention が無ければ null", () => {
    expect(parseLinkHeader('<https://ex.com/a>; rel="canonical"')).toBeNull();
  });

  it("rel に webmention を含む別の語 (webmentions) は取らない", () => {
    expect(
      parseLinkHeader('<https://ex.com/wm>; rel="webmentions"'),
    ).toBeNull();
  });

  it("ヘッダが無ければ null", () => {
    expect(parseLinkHeader(null)).toBeNull();
  });
});
