import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import Page from "./+Page";
import type { HtmlArticleData } from "./htmlArticleData";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));
vi.mock("vike-react/usePageContext", () => ({ usePageContext: vi.fn() }));
vi.mock("vike-react/clientOnly", () => ({ clientOnly: () => () => null }));

afterEach(() => {
  vi.clearAllMocks();
});

function htmlData(spoiler = false): HtmlArticleData {
  return {
    ok: true,
    view: "html",
    title: "部屋の CO2",
    heading: "部屋の CO2",
    pageId: 5,
    articleId: 9,
    render: {
      version: 1,
      head: { links: [], styles: [] },
      body: '<div class="jgs-html-article"><p>中身</p></div>',
    },
    text: ["本文 [a]"],
    description: "本文 [a]",
    spoiler,
    fromDate: "2026-10-31",
    atUri: null,
    related: [],
  };
}

// サーバでの描画。isHydration は無い。
const render = (
  d: HtmlArticleData,
  pageContext: { isHydration?: boolean } = {},
) => {
  vi.mocked(useData).mockReturnValue(d);
  vi.mocked(usePageContext).mockReturnValue(
    pageContext as unknown as ReturnType<typeof usePageContext>,
  );
  return renderToString(createElement(Page));
};

it("ヘッダ・入れ物・帯の順", () => {
  const html = render(htmlData());
  const i = (s: string) => html.indexOf(s);
  expect(i("jgs-e4-")).toBeGreaterThanOrEqual(0);
  expect(i("jgs-e4-")).toBeLessThan(i('class="jgs-html-article"'));
  expect(i('class="jgs-html-article"')).toBeLessThan(i("検索..."));
  expect(i("検索...")).toBeLessThan(i('class="h-entry'));
});

it("e-content は派生テキストを hidden で持つ", () => {
  const html = render(htmlData());
  expect(html).toMatch(
    /<div[^>]*class="e-content"[^>]*hidden=""[^>]*><p>本文 \[a\]<\/p>/,
  );
});

it("h-entry の中に題と日付", () => {
  const html = render(htmlData());
  expect(html).toMatch(
    /<h1[^>]*class="[^"]*p-name[^"]*"[^>]*>部屋の CO2<\/h1>/,
  );
  expect(html).toMatch(/class="dt-published" date[tT]ime="2026-10-31"/);
  const entry = html.slice(html.indexOf('class="h-entry'));
  expect(entry).toContain("Copy Share URL");
});

it("入れ物は h-entry の外", () => {
  const html = render(htmlData());
  expect(html.indexOf('class="jgs-html-article"')).toBeLessThan(
    html.indexOf('class="h-entry'),
  );
});

it("クライアント遷移で来たら何も描かない", () => {
  const html = render(htmlData(), { isHydration: false });
  expect(html).not.toContain("jgs-html-article");
});

it("ネタバレは入れ物を hidden に入れ、表示するボタンを出す", () => {
  const html = render(htmlData(true));
  expect(html).toMatch(/<div hidden=""[^>]*>.*jgs-html-article/s);
  expect(html).toContain("表示する");
});
