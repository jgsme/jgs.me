import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useData } from "vike-react/useData";
import type data from "./+data";
import Page, { DRAFT_NOTICE } from "./+Page";

vi.mock("vike-react/useData", () => ({ useData: vi.fn() }));
vi.mock("vike-react/clientOnly", () => ({ clientOnly: () => () => null }));

type Data = Awaited<ReturnType<typeof data>>;

afterEach(() => {
  vi.clearAllMocks();
});

const draftData = (): Data => ({
  title: "ひみつの題",
  blocks: [],
  embeds: {},
  xhtm: {},
  spoiler: false,
});

it("帯と題を出す", () => {
  vi.mocked(useData).mockReturnValue(draftData());
  const html = renderToString(createElement(Page));
  expect(html).toContain(DRAFT_NOTICE);
  expect(html).toMatch(/<h1[^>]*>ひみつの題<\/h1>/);
});

it("mf2 と共有・反応・関連の部品を出さない", () => {
  vi.mocked(useData).mockReturnValue(draftData());
  const html = renderToString(createElement(Page));
  for (const s of ["h-entry", "u-url", "p-author", "dt-published"]) {
    expect(html).not.toContain(s);
  }
});
