import { describe, expect, it } from "vitest";
import type { ClipNoteItem } from "./clipMarginWrites.ts";
import {
  clampBytes,
  deleteWrites,
  followUpWrites,
  noteCardRkey,
  noteText,
  toSembleClip,
  urlCardRkey,
  urlCardWrite,
  type SembleClip,
} from "./clipSembleRecords.ts";

const DID = "did:web:ds.jgs.me";
const CREATED = "2026-10-20T03:43:05.000Z";
const CLIP_ID = 1706;
const URL_CARD = { uri: `at://${DID}/network.cosmik.card/a`, cid: "bafyA" };
const COLLECTION = {
  uri: `at://${DID}/network.cosmik.collection/c`,
  cid: "bafyC",
};
const BYTES_PER_KANJI = 3;
const TWO_KANJI_BYTES = 6;

const item = (note: Record<string, unknown> | undefined): ClipNoteItem => ({
  clipId: CLIP_ID,
  title: "題",
  note: note && { $type: "at.margin.note", createdAt: CREATED, ...note },
});

const clip = (over: Partial<SembleClip> = {}): SembleClip => ({
  clipId: CLIP_ID,
  createdAt: CREATED,
  url: "https://example.com/a",
  title: "題",
  text: "本文",
  truncated: false,
  ...over,
});

describe("noteText", () => {
  it("引用・本文・タグの順に空行で区切る", () => {
    expect(
      noteText({
        createdAt: CREATED,
        target: { selector: { exact: "一行目\n二行目" } },
        body: { value: "感想" },
        tags: ["memo", "idol"],
      }),
    ).toBe("> 一行目\n> 二行目\n\n感想\n\n#memo #idol");
  });

  it("何も無ければ空", () => {
    expect(noteText({ createdAt: CREATED })).toBe("");
  });
});

describe("clampBytes", () => {
  it("UTF-8 のバイト数で、文字の途中で切らない", () => {
    expect(clampBytes("あいう", TWO_KANJI_BYTES + 1)).toEqual({
      text: "あい",
      truncated: true,
    });
    expect(clampBytes("あ", BYTES_PER_KANJI)).toEqual({
      text: "あ",
      truncated: false,
    });
  });
});

describe("toSembleClip", () => {
  it("出典と題と本文を拾う", () => {
    expect(
      toSembleClip(
        item({
          target: { source: "https://example.com/a", title: "題" },
          body: { value: "本文" },
        }),
      ),
    ).toEqual(clip());
  });

  it("本文が無ければ text を持たない", () => {
    expect(
      toSembleClip(item({ target: { source: "https://example.com/a" } }))?.text,
    ).toBeUndefined();
  });

  it("note が無い (skip された) clip は null", () => {
    expect(toSembleClip(item(undefined))).toBeNull();
  });
});

describe("rkey", () => {
  it("URL カードと NOTE カードで違う", () => {
    expect(urlCardRkey(clip())).not.toBe(noteCardRkey(clip()));
  });
});

describe("urlCardWrite", () => {
  it("Semble と同じ形の URL カード", () => {
    expect(urlCardWrite(clip())).toEqual({
      $type: "com.atproto.repo.applyWrites#update",
      collection: "network.cosmik.card",
      rkey: urlCardRkey(clip()),
      value: {
        $type: "network.cosmik.card",
        type: "URL",
        content: {
          $type: "network.cosmik.card#urlContent",
          url: "https://example.com/a",
          metadata: { $type: "network.cosmik.card#urlMetadata", title: "題" },
        },
        createdAt: CREATED,
      },
    });
  });
});

describe("followUpWrites", () => {
  it("NOTE カードを URL カードにぶら下げ、URL カードをコレクションに入れる", () => {
    const [note, link] = followUpWrites(clip(), URL_CARD, COLLECTION, DID);

    expect(note?.collection).toBe("network.cosmik.card");
    expect(note && "value" in note && note.value).toMatchObject({
      type: "NOTE",
      content: { $type: "network.cosmik.card#noteContent", text: "本文" },
      url: "https://example.com/a",
      parentCard: URL_CARD,
    });
    expect(link && "value" in link && link.value).toEqual({
      $type: "network.cosmik.collectionLink",
      collection: COLLECTION,
      card: URL_CARD,
      addedBy: DID,
      addedAt: CREATED,
      createdAt: CREATED,
    });
  });

  it("本文が無ければ link だけ", () => {
    expect(
      followUpWrites(clip({ text: undefined }), URL_CARD, COLLECTION, DID).map(
        (w) => w.collection,
      ),
    ).toEqual(["network.cosmik.collectionLink"]);
  });
});

describe("deleteWrites", () => {
  it("link、NOTE、URL カードの順に消す", () => {
    expect(deleteWrites(clip()).map((w) => [w.$type, w.collection])).toEqual([
      ["com.atproto.repo.applyWrites#delete", "network.cosmik.collectionLink"],
      ["com.atproto.repo.applyWrites#delete", "network.cosmik.card"],
      ["com.atproto.repo.applyWrites#delete", "network.cosmik.card"],
    ]);
  });
});
