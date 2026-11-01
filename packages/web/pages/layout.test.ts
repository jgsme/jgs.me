import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { usePageContext } from "vike-react/usePageContext";
import { Layout } from "./Layout";

vi.mock("vike-react/usePageContext", () => ({ usePageContext: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

const render = (data: unknown) => {
  vi.mocked(usePageContext).mockReturnValue({
    urlPathname: "/pages/x",
    data,
  } as unknown as ReturnType<typeof usePageContext>);
  return renderToString(createElement(Layout, null, createElement("main")));
};

it("html 記事では上の帯と検索窓を出さない", () => {
  const html = render({ ok: true, view: "html" });
  expect(html).not.toContain('src="/mark.svg"');
  expect(html).not.toContain("検索...");
  expect(html).toContain("<main>");
});

it("それ以外のページでは今どおり", () => {
  const html = render({ ok: true });
  expect(html).toContain('src="/mark.svg"');
  expect(html).toContain("検索...");
});
