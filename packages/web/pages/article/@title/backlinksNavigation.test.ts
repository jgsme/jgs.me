// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import type data from "./+data";
import Page from "./+Page";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));
// Reactions are a separate client-only island, unrelated to backlink navigation.
vi.mock("vike-react/clientOnly", () => ({ clientOnly: () => () => null }));

type Data = Awaited<ReturnType<typeof data>>;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function pageData(
  ok: boolean,
  title: string,
  titles: string[],
  hasMore = false,
): Data {
  const common = {
    title,
    pageId: 1,
    articleId: null,
    clipId: null,
    clipKind: null,
    blocks: [],
    description: null,
    related: [],
    backlinks: titles.map((title) => ({ title, image: null })),
    hasMore,
  };
  return ok
    ? { ...common, ok: true, clipId: 1, fromDate: null, description: "" }
    : { ...common, ok: false };
}

async function navigate(d: Data) {
  vi.mocked(useData).mockReturnValue(d);
  await act(async () => root.render(createElement(Page)));
}

function visiblePages() {
  return Array.from(container.querySelectorAll("section li"), (li) =>
    li.textContent?.trim(),
  );
}

it.each([false, true])(
  "replaces backlinks on navigation (has body: %s)",
  async (ok) => {
    await navigate(pageData(ok, "A", ["A-related"], true));
    expect(visiblePages()).toEqual(["A-related"]);
    expect(container.textContent).toContain("もっと見る");

    await navigate(pageData(ok, "B", ["B-related"]));
    expect(visiblePages()).toEqual(["B-related"]);
    expect(container.textContent).not.toContain("もっと見る");

    await navigate(pageData(ok, "C", []));
    expect(visiblePages()).toEqual([]);
    expect(container.textContent).not.toContain("関連ページ");
    if (!ok) expect(container.textContent).toContain("Page not found");
  },
);

function moreButton() {
  const button = container.querySelector<HTMLButtonElement>("section button");
  if (!button) throw new Error("Expected a load-more button");
  return button;
}

it.each([false, true])(
  "keeps appended backlinks on the same page, but resets on navigation (has body: %s)",
  async (ok) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          backlinks: [{ title: "A-extra", image: null }],
          hasMore: false,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const a = pageData(ok, "A", ["A-related"], true);
    await navigate(a);
    await act(async () => moreButton().click());
    expect(fetchMock).toHaveBeenCalledWith("/api/backlinks?title=A&offset=1");
    expect(visiblePages()).toEqual(["A-related", "A-extra"]);
    expect(container.textContent).not.toContain("もっと見る");

    await navigate(a);
    expect(visiblePages()).toEqual(["A-related", "A-extra"]);

    await navigate(pageData(ok, "B", ["B-related"], true));
    expect(visiblePages()).toEqual(["B-related"]);
    expect(moreButton().disabled).toBe(false);
    expect(moreButton().textContent).toBe("もっと見る");
  },
);

it.each([false, true])(
  "ignores an old page's pending response after navigation (has body: %s)",
  async (ok) => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    await navigate(pageData(ok, "A", ["A-related"], true));
    await act(async () => moreButton().click());
    expect(moreButton().disabled).toBe(true);
    expect(moreButton().textContent).toBe("読み込み中");

    await navigate(pageData(ok, "B", ["B-related"], true));
    expect(visiblePages()).toEqual(["B-related"]);
    expect(moreButton().disabled).toBe(false);
    expect(moreButton().textContent).toBe("もっと見る");

    await act(async () => {
      resolve(
        new Response(
          JSON.stringify({
            backlinks: [{ title: "A-late", image: null }],
            hasMore: false,
          }),
        ),
      );
      await pending;
    });
    expect(visiblePages()).toEqual(["B-related"]);
    expect(moreButton().disabled).toBe(false);
    expect(moreButton().textContent).toBe("もっと見る");
  },
);

it.each([false, true])(
  "renders initial backlinks during SSR (has body: %s)",
  (ok) => {
    vi.mocked(useData).mockReturnValue(pageData(ok, "A", ["A-related"], true));
    const html = renderToString(createElement(Page));
    expect(html).toContain("関連ページ");
    expect(html).toContain('href="/pages/A-related"');
    expect(html).toContain("もっと見る");
  },
);
