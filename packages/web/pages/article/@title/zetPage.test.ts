import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import type data from "./+data";
import Page from "./+Page";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));
vi.mock("vike-react/clientOnly", () => ({ clientOnly: () => () => null }));

type Data = Awaited<ReturnType<typeof data>>;

afterEach(() => {
  vi.clearAllMocks();
});

const RKEY = "3m2abcdefghij";

function zetData(heading: string, isName: boolean): Data {
  return {
    ok: true,
    title: `zet:${RKEY}`,
    heading,
    isName,
    pageId: 7,
    articleId: null,
    clipId: null,
    zetId: null,
    atUri: `at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`,
    clipKind: null,
    blocks: [],
    fromDate: "2026-10-11",
    description: "",
    related: [],
    backlinks: [],
    hasMore: false,
  };
}

// zet は記事ページで出す。page.title (zet:<rkey>) は内部キーなので、
// 見える文字にも u-url の文字にも出さない (URL の zet%3A は出てよい)。
it("題の無い zet は日付を見出しにし、zet: を文字として出さない", () => {
  vi.mocked(useData).mockReturnValue(zetData("2026-10-11", false));
  const html = renderToString(createElement(Page));

  expect(html).toMatch(/<h1[^>]*>2026-10-11<\/h1>/);
  expect(html).not.toContain("zet:");
  expect(html).toContain(`href="https://w.jgs.me/pages/zet%3A${RKEY}"`);
  // 日付は題ではないので p-name にしない。
  expect(html).not.toMatch(/<h1[^>]*p-name/);
});

it("題のある zet は題を p-name の見出しにする", () => {
  vi.mocked(useData).mockReturnValue(zetData("朝の散歩", true));
  const html = renderToString(createElement(Page));

  expect(html).toMatch(/<h1[^>]*p-name[^>]*>朝の散歩<\/h1>/);
  expect(html).not.toContain("zet:");
});

it("zet は at-uri を pdsls へのリンクで出す", () => {
  vi.mocked(useData).mockReturnValue(zetData("朝の散歩", true));
  const html = renderToString(createElement(Page));

  const atUri = `at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`;
  expect(html).toContain(`href="https://pdsls.dev/${atUri}"`);
  expect(html).toContain(`>${atUri}</a>`);
});
