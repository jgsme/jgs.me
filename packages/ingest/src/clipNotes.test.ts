import { describe, expect, it } from "vitest";
import {
  runClipNotes,
  type ClipNoteRow,
  type ClipNotesDeps,
} from "./clipNotes";

const row = (clipId: number): ClipNoteRow => ({
  clipId,
  title: `題${clipId}`,
  created: "2020-01-01 00:00:00",
  bodyKey: `sb-${clipId}`,
});

function deps(
  rows: readonly ClipNoteRow[],
  bodies: Readonly<Record<string, string>>,
): ClipNotesDeps {
  return {
    listClips: async (cursor, limit) =>
      rows.filter((r) => r.clipId > cursor).slice(0, limit),
    readBody: async (bodyKey) => bodies[bodyKey] ?? null,
  };
}

const ROWS = [1, 2, 3].map(row);
const WIDE = 10;
const NARROW = 2;

describe("runClipNotes", () => {
  it("変換できない clip は skip に理由を入れて続ける", async () => {
    const d = deps(ROWS, {
      "sb-1": "題1\n[https://example.com/a]",
      "sb-2": "題2\n本文だけ",
    });

    const r = await runClipNotes(d, 0, WIDE);

    expect(r.items.map((i) => i.skip)).toEqual([
      undefined,
      "出典 URL が見つからない",
      "本文が読めない",
    ]);
    expect(r.items[0]?.note?.target.source).toBe("https://example.com/a");
    expect(r.nextCursor).toBeNull();
  });

  it("limit 件ちょうど取れたら最後の clip id を cursor に返す", async () => {
    const d = deps(ROWS, {});

    const r = await runClipNotes(d, 0, NARROW);

    expect(r.processed).toBe(NARROW);
    expect(r.nextCursor).toBe(ROWS[NARROW - 1]?.clipId);
  });
});
