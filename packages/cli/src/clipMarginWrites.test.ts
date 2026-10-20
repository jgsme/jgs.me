import { describe, expect, it } from "vitest";
import {
  clipTid,
  deletesFor,
  reportLines,
  writesFor,
  type ClipNoteItem,
} from "./clipMarginWrites.ts";

const DID = "did:web:ds.jgs.me";
const COLLECTION = `at://${DID}/at.margin.collection/3mybpszk6ns2v`;
const CREATED = "2026-10-20T03:43:05.000Z";
const CLIP_ID = 1706;
const OTHER_CLIP_ID = 1705;

const item = (over: Partial<ClipNoteItem> = {}): ClipNoteItem => ({
  clipId: CLIP_ID,
  title: "題",
  note: { $type: "at.margin.note", createdAt: CREATED },
  ...over,
});

describe("clipTid", () => {
  // Margin 拡張が約 1 秒後に採番した TID (3mybpquq5ss2v) と上位が揃う。
  it("13 文字で、近い時刻なら上位が揃う", () => {
    const tid = clipTid(CREATED, CLIP_ID);

    expect(tid).toHaveLength("3mybpquq5ss2v".length);
    expect(tid.startsWith("3mybpq")).toBe(true);
  });

  it("同じ clip なら同じ値、clip が違えば違う値", () => {
    expect(clipTid(CREATED, CLIP_ID)).toBe(clipTid(CREATED, CLIP_ID));
    expect(clipTid(CREATED, CLIP_ID)).not.toBe(clipTid(CREATED, OTHER_CLIP_ID));
  });
});

describe("writesFor", () => {
  it("note と collectionItem を同じ rkey で update する", () => {
    const [note, link] = writesFor(item(), DID, COLLECTION);
    const rkey = clipTid(CREATED, CLIP_ID);

    expect(note).toMatchObject({ collection: "at.margin.note", rkey });
    expect(link).toEqual({
      $type: "com.atproto.repo.applyWrites#update",
      collection: "at.margin.collectionItem",
      rkey,
      value: {
        $type: "at.margin.collectionItem",
        annotation: `at://${DID}/at.margin.note/${rkey}`,
        collection: COLLECTION,
        createdAt: CREATED,
      },
    });
  });

  it("note が無ければ何も積まない", () => {
    expect(
      writesFor(item({ note: undefined, skip: "x" }), DID, COLLECTION),
    ).toEqual([]);
  });
});

describe("deletesFor", () => {
  it("collectionItem と note を同じ rkey で消す", () => {
    const rkey = clipTid(CREATED, CLIP_ID);

    expect(deletesFor(item())).toEqual([
      {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "at.margin.collectionItem",
        rkey,
      },
      {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "at.margin.note",
        rkey,
      },
    ]);
  });

  it("note が無ければ何も積まない", () => {
    expect(deletesFor(item({ note: undefined, skip: "x" }))).toEqual([]);
  });
});

describe("reportLines", () => {
  it("skip と warnings のある clip だけを出す", () => {
    expect(
      reportLines([
        item(),
        item({ note: undefined, skip: "出典 URL が見つからない" }),
        item({ warnings: ["画像を落とした", "表を落とした"] }),
      ]),
    ).toEqual([
      "skip\tc/1706\t題\t出典 URL が見つからない",
      "warn\tc/1706\t題\t画像を落とした / 表を落とした",
    ]);
  });
});
