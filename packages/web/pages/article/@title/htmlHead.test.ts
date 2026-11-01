import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import { Head } from "./+Head";
import { buildHtmlArticleData } from "./htmlArticleData";
import { buildArticleBody } from "./articleBody";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

const AT_URI = "at://did:web:ds.jgs.me/site.standard.document/3m2abcdefghij";

function htmlData() {
  return buildHtmlArticleData({
    title: "題",
    pageId: 1,
    articleId: 2,
    spoiler: false,
    date: "2026-11-01",
    sbBody: "題\n本文",
    atUri: AT_URI,
    related: [],
    render: {
      version: 1,
      head: {
        links: [
          {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Inter",
          },
        ],
        styles: [{ css: ".jgs-html-article{--a:1}", media: null }],
      },
      body: "<div class='jgs-html-article'></div>",
    },
  });
}

it("site.standard.document の link と、組み直しの link / style を head に出す", () => {
  vi.mocked(useData).mockReturnValue(htmlData());
  const html = renderToString(createElement(Head));
  expect(html).toContain(
    `<link rel="site.standard.document" href="${AT_URI}"/>`,
  );
  expect(html).toContain(
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"',
  );
  expect(html).toContain("<style>.jgs-html-article{--a:1}</style>");
});

it("html 記事でなければ組み直しを出さない", () => {
  vi.mocked(useData).mockReturnValue({
    ok: true,
    title: "題",
    pageId: 1,
    description: "",
    atUri: null,
    blocks: buildArticleBody("題\n本文").blocks,
  });
  const html = renderToString(createElement(Head));
  expect(html).not.toContain("jgs-html-article");
  expect(html).not.toContain("site.standard.document");
});

it("style の css に </style> があっても head を抜け出さない", () => {
  const d = htmlData();
  d.render.head.styles = [
    { css: "a{}</StYlE><script>alert(1)</script>", media: null },
  ];
  vi.mocked(useData).mockReturnValue(d);
  const html = renderToString(createElement(Head));
  expect(html).not.toMatch(/<\/style><script>/i);
  expect(html).toContain("a{}");
});
