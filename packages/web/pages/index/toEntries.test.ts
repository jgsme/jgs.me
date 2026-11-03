import { describe, expect, it } from "vitest";
import { pagePath } from "@jigsaw/db/page-path";
import { zetDisplayTitle, zetPath } from "@jigsaw/db/zet";
import { parsePage, toPageEntry, toZetEntry } from "./toEntries";
import type { PageRow, ZetRow } from "./timelineQuery";

const pageRow: PageRow = {
  id: 7,
  title: "記事 A",
  image: null,
  created: "2026-11-01T00:00:00Z",
  day: "2026-11-01",
  spoiler: false,
  bodyKey: "k",
};
const zetRow: ZetRow = {
  ...pageRow,
  title: "zet:abc",
  rkey: "abc",
  zetTitle: "題",
  zetDate: "2026-11-01",
};

describe("parsePage", () => {
  it.each([
    ["1", 1],
    ["3", 3],
    [undefined, 1],
    ["0", 1],
    ["-1", 1],
    ["abc", 1],
    ["2.7", 2],
  ])("%s -> %s", (input, want) => {
    expect(parsePage(input)).toBe(want);
  });
});

describe("toPageEntry", () => {
  it("article", () => {
    const e = toPageEntry("article", pageRow);
    expect(e.href).toBe(pagePath("記事 A"));
    expect(e.key).toBe("article:7");
    expect(e.excerpt).toBeNull();
    expect(e.day).toBe("2026-11-01");
  });
});

describe("toZetEntry", () => {
  it("題あり", () => {
    const e = toZetEntry(zetRow, null);
    expect(e.title).toBe("題");
    expect(e.href).toBe(zetPath("abc"));
    expect(e.key).toBe("zet:abc");
  });
  it("題無し・抜粋あり", () => {
    const e = toZetEntry({ ...zetRow, zetTitle: null }, "本文の頭");
    expect(e.title).toBe("本文の頭");
    expect(e.excerpt).toBe("本文の頭");
  });
  it("題無し・抜粋無し", () => {
    const e = toZetEntry({ ...zetRow, zetTitle: " " }, null);
    expect(e.title).toBe(zetDisplayTitle({ title: null, date: "2026-11-01" }));
  });
  it("spoiler は抜粋を使わない", () => {
    const e = toZetEntry(
      { ...zetRow, zetTitle: null, spoiler: true },
      "漏れる",
    );
    expect(e.excerpt).toBeNull();
    expect(e.title).toBe("2026-11-01");
  });
});
