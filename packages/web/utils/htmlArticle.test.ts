import { describe, expect, it } from "vitest";
import {
  htmlArticleDescription,
  htmlArticleText,
  isHtmlArticleData,
} from "./htmlArticle";
import { buildHtmlArticleData } from "@/pages/article/@title/htmlArticleData";

describe("htmlArticle", () => {
  it("本文は題の行を落とし、空行を除く", () => {
    expect(htmlArticleText("題\n一行目 [a]\n\n#1 位")).toEqual([
      "一行目 [a]",
      "#1 位",
    ]);
  });

  it("抜粋は [..] / # / バッククォートを残す", () => {
    expect(htmlArticleDescription("題\n配列 [1, 2] と #1\n`x`  code:y")).toBe(
      "配列 [1, 2] と #1 `x` code:y",
    );
  });

  it("抜粋は 200 文字", () => {
    expect(htmlArticleDescription(`題\n${"あ".repeat(300)}`)).toHaveLength(200);
  });

  it("isHtmlArticleData", () => {
    expect(isHtmlArticleData({ ok: true, view: "html" })).toBe(true);
    expect(isHtmlArticleData({ ok: true })).toBe(false);
    expect(isHtmlArticleData(undefined)).toBe(false);
  });
});

describe("buildHtmlArticleData", () => {
  const input = {
    title: "題",
    pageId: 1,
    articleId: 2,
    spoiler: false,
    date: "2026-11-01",
    sbBody: "題\n本文 [a]",
    render: {
      version: 1,
      head: { links: [], styles: [] },
      body: "<div></div>",
    },
    atUri: null,
    related: [],
  };

  it("本文から text と description を作る", () => {
    const d = buildHtmlArticleData(input);
    expect(d.view).toBe("html");
    expect(d.text).toEqual(["本文 [a]"]);
    expect(d.description).toBe("本文 [a]");
    expect(d.fromDate).toBe("2026-11-01");
  });

  it("spoiler なら description を伏せる", () => {
    expect(buildHtmlArticleData({ ...input, spoiler: true }).description).toBe(
      "ネタバレ注意",
    );
  });
});
