import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import type data from "./+data";
import Page from "./+Page";
import { buildArticleBody } from "./articleBody";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));
vi.mock("vike-react/clientOnly", () => ({ clientOnly: () => () => null }));

type Data = Awaited<ReturnType<typeof data>>;

afterEach(() => {
  vi.clearAllMocks();
});

function articleData(spoiler: boolean): Data {
  return {
    ok: true,
    title: "ミステリの感想",
    heading: "ミステリの感想",
    isName: true,
    pageId: 7,
    articleId: 3,
    clipId: null,
    zetId: null,
    atUri: null,
    clipKind: null,
    blocks: buildArticleBody("ミステリの感想\n犯人は執事").blocks,
    spoiler,
    fromDate: "2026-10-23",
    description: "",
    related: [],
    backlinks: [],
    hasMore: false,
  };
}

it("ネタバレの記事は本文を HTML に残したまま隠し、表示するボタンを出す", () => {
  vi.mocked(useData).mockReturnValue(articleData(true));
  const html = renderToString(createElement(Page));

  expect(html).toMatch(/<div hidden=""[^>]*>.*犯人は執事/s);
  expect(html).toContain("表示する");
  expect(html).toMatch(/<h1[^>]*>ミステリの感想<\/h1>/);
});

it("ネタバレでなければ本文をそのまま描く", () => {
  vi.mocked(useData).mockReturnValue(articleData(false));
  const html = renderToString(createElement(Page));

  expect(html).toContain("犯人は執事");
  expect(html).not.toContain("表示する");
});
