import { describe, expect, it } from "vitest";
import { SB_PREFIX, bodyFormatOf, newSbBodyKey, r2KeyOf } from "./bodyKey";

describe("newSbBodyKey", () => {
  it("sb- で始まる", () => {
    expect(newSbBodyKey().startsWith("sb-")).toBe(true);
  });

  it("呼ぶたびに違う値になる", () => {
    expect(newSbBodyKey()).not.toBe(newSbBodyKey());
  });

  it("R2 のキーとして安全な文字だけを使う", () => {
    expect(newSbBodyKey()).toMatch(/^sb-[0-9a-f-]+$/);
  });
});

describe("bodyFormatOf", () => {
  it("sb- で始まれば micropub-sb", () => {
    expect(bodyFormatOf("sb-abc")).toBe("micropub-sb");
  });

  it("Scrapbox ID は scrapbox-archive", () => {
    expect(bodyFormatOf("5f8a1b2c3d4e5f6a7b8c9d0e")).toBe("scrapbox-archive");
  });

  it("廃止した mp- は scrapbox-archive 扱いになる (削除済みのため実データには存在しない)", () => {
    expect(bodyFormatOf("mp-0189abcd")).toBe("scrapbox-archive");
  });
});

describe("r2KeyOf", () => {
  it("Scrapbox 由来は .json", () => {
    expect(r2KeyOf("5f8a1b2c")).toBe("5f8a1b2c.json");
  });

  it("Micropub 由来は .sb", () => {
    expect(r2KeyOf("sb-0189abcd")).toBe("sb-0189abcd.sb");
  });

  it("空文字なら null (本文が存在しない)", () => {
    expect(r2KeyOf("")).toBeNull();
  });

  it("prefix は sb-", () => {
    expect(SB_PREFIX).toBe("sb-");
  });
});
