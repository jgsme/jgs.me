import { describe, expect, it } from "vitest";
import { endpointCandidate, parseLinkHeader } from "./discovery";

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

describe("endpointCandidate", () => {
  it("rel=webmention と href が揃っていれば href を返す", () => {
    expect(endpointCandidate("webmention", "/wm")).toBe("/wm");
  });

  it("複数の rel 値に混ざっていても取る", () => {
    expect(endpointCandidate("something webmention", "/wm")).toBe("/wm");
  });

  // href="" は「このページ自身が endpoint」を意味する有効な値。
  it("href が空文字なら空文字を返す (ページ自身が endpoint)", () => {
    expect(endpointCandidate("webmention", "")).toBe("");
  });

  // webmention.rocks discovery test 20。href 属性を持たない <link> は
  // HTML 上リンクではないので候補にせず、後続の要素を探し続ける。
  it("href 属性が無ければ候補にしない", () => {
    expect(endpointCandidate("webmention", null)).toBeNull();
  });

  it("rel に webmention を含む別の語 (webmentions) は取らない", () => {
    expect(endpointCandidate("webmentions", "/wm")).toBeNull();
  });

  it("rel が無ければ候補にしない", () => {
    expect(endpointCandidate(null, "/wm")).toBeNull();
  });

  it("rel が空文字なら候補にしない", () => {
    expect(endpointCandidate("", "/wm")).toBeNull();
  });
});
