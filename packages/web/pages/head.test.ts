import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { usePageContext } from "vike-react/usePageContext";
import { Head } from "./+Head";

vi.mock("vike-react/usePageContext", () => ({ usePageContext: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function at(path: string) {
  vi.mocked(usePageContext).mockReturnValue({ urlPathname: path } as never);
}

const DRAFT = "/drafts/" + "A".repeat(43);

it("draft のページには gtag を出さない", () => {
  at(DRAFT);
  const html = renderToString(createElement(Head));
  expect(html).not.toContain("googletagmanager");
  expect(html).not.toContain("gtag(");
});

it("draft のページでも feed と webmention の link は出す", () => {
  at(DRAFT);
  const html = renderToString(createElement(Head));
  expect(html).toContain('rel="webmention"');
  expect(html).toContain('rel="me"');
  expect(html).toContain('href="/rss.xml"');
  expect(html).toContain('href="/clips.xml"');
});

it.each(["/", "/pages/%E9%A1%8C", "/clips", "/search"])(
  "%s には gtag を今までどおり出す",
  (p) => {
    at(p);
    const html = renderToString(createElement(Head));
    expect(html).toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-SJB62M7N1F",
    );
    expect(html).toContain("gtag('config', 'G-SJB62M7N1F')");
  },
);
