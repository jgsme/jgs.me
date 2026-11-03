import { describe, expect, it } from "vitest";
import {
  formatDay,
  groupByDay,
  pinLatestArticle,
  type EntryKind,
  type TimelineDay,
  type TimelineEntry,
} from "./timeline";

let seq = 0;
const entry = (
  kind: EntryKind,
  day: string,
  created = `${day}T03:00:00.000Z`,
  over: Partial<TimelineEntry> = {},
): TimelineEntry => {
  seq += 1;
  return {
    kind,
    key: `${kind}:${seq}`,
    day,
    created,
    href: `/x/${seq}`,
    title: `t${seq}`,
    image: null,
    excerpt: null,
    ...over,
  };
};

const dayOf = (day: string, over: Partial<TimelineDay> = {}): TimelineDay => ({
  day,
  articles: [],
  tiles: [],
  texts: [],
  ...over,
});

describe("groupByDay", () => {
  it("days are newest first", () => {
    const days = groupByDay([
      entry("article", "2026-10-22"),
      entry("article", "2026-11-03"),
      entry("article", "2026-10-30"),
    ]);
    expect(days.map((d) => d.day)).toEqual([
      "2026-11-03",
      "2026-10-30",
      "2026-10-22",
    ]);
  });

  it("article goes to articles, imaged non-article to tiles, the rest to texts", () => {
    const day = "2026-11-03";
    const [d] = groupByDay([
      entry("article", day),
      entry("clip", day, undefined, { image: "https://x/a.png" }),
      entry("zet", day, undefined, { image: "https://x/b.png" }),
      entry("zet", day),
      entry("clip", day),
    ]);
    expect(d.articles).toHaveLength(1);
    expect(d.tiles).toHaveLength(2);
    expect(d.texts).toHaveLength(2);
  });

  it("druck without image is still a tile", () => {
    const [d] = groupByDay([entry("druck", "2026-11-03")]);
    expect(d.tiles).toHaveLength(1);
    expect(d.texts).toHaveLength(0);
  });

  it("two articles on one day both stay articles", () => {
    const [d] = groupByDay([
      entry("article", "2026-10-10"),
      entry("article", "2026-10-10"),
    ]);
    expect(d.articles).toHaveLength(2);
  });

  it("within a bucket newer created comes first", () => {
    const older = entry("clip", "2026-11-02", "2026-11-02T15:49:19.632Z", {
      image: "https://x/1.png",
    });
    const newer = entry("clip", "2026-11-02", "2026-11-02T15:56:47.637Z", {
      image: "https://x/2.png",
    });
    const [d] = groupByDay([older, newer]);
    expect(d.tiles.map((e) => e.key)).toEqual([newer.key, older.key]);
  });
});

describe("pinLatestArticle", () => {
  it("no pin when the newest day has an article", () => {
    const a = entry("article", "2026-11-03");
    const days = [dayOf("2026-11-03", { articles: [a] })];
    const r = pinLatestArticle(days, a);
    expect(r.pinned).toBeNull();
    expect(r.days).toEqual(days);
  });

  it("pins and removes from its day when newest day has none", () => {
    const a = entry("article", "2026-10-22");
    const z = entry("zet", "2026-10-22");
    const days = [
      dayOf("2026-10-30", { texts: [entry("clip", "2026-10-30")] }),
      dayOf("2026-10-22", { articles: [a], texts: [z] }),
    ];
    const r = pinLatestArticle(days, a);
    expect(r.pinned?.key).toBe(a.key);
    const d = r.days.find((x) => x.day === "2026-10-22")!;
    expect(d.articles).toEqual([]);
    expect(d.texts.map((e) => e.key)).toEqual([z.key]);
  });

  it("drops a day that becomes empty after unpinning", () => {
    const a = entry("article", "2026-10-22");
    const days = [
      dayOf("2026-10-30", { texts: [entry("clip", "2026-10-30")] }),
      dayOf("2026-10-22", { articles: [a] }),
    ];
    const r = pinLatestArticle(days, a);
    expect(r.days.map((d) => d.day)).toEqual(["2026-10-30"]);
  });

  it("pins without touching days when latest is outside the window", () => {
    const latest = entry("article", "2026-09-01");
    const days = [
      dayOf("2026-10-30", { texts: [entry("clip", "2026-10-30")] }),
    ];
    const r = pinLatestArticle(days, latest);
    expect(r.pinned).toBe(latest);
    expect(r.days).toEqual(days);
  });

  it("no pin without any article", () => {
    const days = [
      dayOf("2026-10-30", { texts: [entry("clip", "2026-10-30")] }),
    ];
    expect(pinLatestArticle(days, null).pinned).toBeNull();
  });

  it("no pin on empty days", () => {
    const latest = entry("article", "2026-09-01");
    expect(pinLatestArticle([], latest).pinned).toBeNull();
  });
});

describe("formatDay", () => {
  it("formats with and without year", () => {
    expect(formatDay("2026-11-03", false)).toBe("11.03");
    expect(formatDay("2026-10-20", true)).toBe("2026.10.20");
    expect(formatDay("2008-01-05", false)).toBe("01.05");
  });
});
