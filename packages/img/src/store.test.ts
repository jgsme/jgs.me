import { describe, expect, it } from "vitest";
import {
  storeUpload,
  type InsertRow,
  type RowState,
  type StoreDeps,
} from "./store";
import type { ParsedUpload } from "./upload";
import { mediaKey } from "@jigsaw/media";

// echo -n hello | shasum -a 256
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function upload(over: Partial<ParsedUpload> = {}): ParsedUpload {
  return {
    bytes: new TextEncoder().encode("hello").buffer as ArrayBuffer,
    contentType: "image/png",
    sourceURL: "https://example.com/a",
    srcURL: "https://example.com/a.png",
    sourceTitle: "題",
    width: 1200,
    height: 800,
    ...over,
  };
}

function deps(state: RowState = "none") {
  const puts: string[] = [];
  const rows: InsertRow[] = [];
  const revived: InsertRow[] = [];
  const d: StoreDeps = {
    state: async () => state,
    put: async (bytes, contentType) => {
      const key = await mediaKey(bytes, contentType);
      if (key !== null) puts.push(key);
      return key;
    },
    insert: async (row) => {
      rows.push(row);
    },
    revive: async (row) => {
      revived.push(row);
    },
  };
  return { deps: d, puts, rows, revived };
}

describe("storeUpload", () => {
  it("新規なら put して 1 行入れる", async () => {
    const { deps: d, puts, rows } = deps();

    const r = await storeUpload(upload(), d);

    expect(r).toEqual({ id: HELLO_SHA256, duplicate: false });
    expect(puts).toEqual([`${HELLO_SHA256}.png`]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: HELLO_SHA256,
      ext: "png",
      sourceURL: "https://example.com/a",
      srcURL: "https://example.com/a.png",
      sourceTitle: "題",
      width: 1200,
      height: 800,
      bytes: 5,
    });
  });

  // 出典を上書きしない。最初に投稿したときのものを残す。
  it("既に行があれば put も insert もしない", async () => {
    const { deps: d, puts, rows } = deps("live");

    const r = await storeUpload(upload({ sourceTitle: "別の題" }), d);

    expect(r).toEqual({ id: HELLO_SHA256, duplicate: true });
    expect(puts).toEqual([]);
    expect(rows).toEqual([]);
  });

  // ページを消した画像の再投稿は、消す前に戻すのではなく新しく投稿したものとして
  // 扱う。出典も今回のものに差し替える。
  it("消した行があれば put して行を上書きで復活させる", async () => {
    const { deps: d, puts, rows, revived } = deps("deleted");

    const r = await storeUpload(upload({ sourceTitle: "別の題" }), d);

    expect(r).toEqual({ id: HELLO_SHA256, duplicate: false });
    expect(puts).toEqual([`${HELLO_SHA256}.png`]);
    expect(rows).toEqual([]);
    expect(revived).toHaveLength(1);
    expect(revived[0]).toMatchObject({
      id: HELLO_SHA256,
      sourceTitle: "別の題",
    });
  });

  it("キーを作れない Content-Type なら null", async () => {
    const { deps: d } = deps();
    expect(
      await storeUpload(upload({ contentType: "image/svg+xml" }), d),
    ).toBeNull();
  });

  it("ext はキーから導く (jpeg は jpg)", async () => {
    const { deps: d, rows } = deps();
    await storeUpload(upload({ contentType: "image/jpeg" }), d);
    expect(rows[0]?.ext).toBe("jpg");
  });
});
