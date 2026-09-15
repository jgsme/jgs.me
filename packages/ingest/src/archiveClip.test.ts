import { describe, expect, it } from "vitest";
import { parseEntry } from "./mf2";
import {
  archiveClipProperties,
  sqliteTimestampToISO,
  type ArchiveClip,
} from "./archiveClip";

const TITLE = "rancher/k3s: Lightweight Kubernetes. 5 less than k8s.";

const clip = (over: Partial<ArchiveClip> = {}): ArchiveClip => ({
  title: TITLE,
  created: "2019-02-26 03:04:05",
  image: null,
  kind: "link",
  text: [
    TITLE,
    `[${TITLE} https://github.com/rancher/k3s]`,
    "",
    "k8s の軽量実装らしい",
    "#20190226 #0226",
  ].join("\n"),
  ...over,
});

describe("sqliteTimestampToISO", () => {
  // page.created は SQLite の CURRENT_TIMESTAMP 形式で入っている (TZ 無し、UTC)。
  it("秒までの SQLite 形式を UTC として読む", () => {
    expect(sqliteTimestampToISO("2019-10-01 09:35:02")).toBe(
      "2019-10-01T09:35:02.000Z",
    );
  });

  it("マイクロ秒付きはミリ秒に丸める", () => {
    expect(sqliteTimestampToISO("2022-09-29 09:02:14.694206")).toBe(
      "2022-09-29T09:02:14.694Z",
    );
  });

  // Micropub 由来の page.created は ISO で入っている。
  it("ISO 8601 はそのまま通す", () => {
    expect(sqliteTimestampToISO("2026-08-31T15:25:41.597Z")).toBe(
      "2026-08-31T15:25:41.597Z",
    );
  });

  it("読めない文字列は throw する", () => {
    expect(() => sqliteTimestampToISO("not a date")).toThrow();
  });
});

describe("archiveClipProperties", () => {
  it("name は題、content は 2 行目以降、category は clip と kind", () => {
    expect(archiveClipProperties(clip({ kind: "quote" }))).toEqual({
      name: [TITLE],
      content: [
        [
          `[${TITLE} https://github.com/rancher/k3s]`,
          "",
          "k8s の軽量実装らしい",
          "#20190226 #0226",
        ].join("\n"),
      ],
      category: ["clip", "quote"],
      published: ["2019-02-26T03:04:05.000Z"],
    });
  });

  it("image があれば photo に入れる", () => {
    const props = archiveClipProperties(
      clip({ image: "https://r2.jgs.me/abc.png" }),
    );
    expect(props["photo"]).toEqual(["https://r2.jgs.me/abc.png"]);
  });

  // mf2 は全ての値が配列。null を混ぜると parseEntry の firstString が読めない。
  it("image が null なら photo のキーごと落とす", () => {
    expect("photo" in archiveClipProperties(clip())).toBe(false);
  });

  it("題の行しか無ければ content は空文字", () => {
    expect(archiveClipProperties(clip({ text: TITLE }))["content"]).toEqual([
      "",
    ]);
  });

  // update はこの properties を土台に applyUpdate → parseEntry する。
  it("そのまま parseEntry に通る", () => {
    const entry = parseEntry({
      type: ["h-entry"],
      properties: archiveClipProperties(clip({ kind: "photo" })),
    });
    expect(entry.name).toBe(TITLE);
    expect(entry.categories).toEqual(["clip", "photo"]);
    expect(entry.published).toBe("2019-02-26T03:04:05.000Z");
  });
});
