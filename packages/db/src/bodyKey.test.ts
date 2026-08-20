import { describe, expect, it } from "vitest";
import {
  MICROPUB_PREFIX,
  isMicropubBodyKey,
  newMicropubBodyKey,
  r2KeyOf,
} from "./bodyKey";

describe("newMicropubBodyKey", () => {
  it("mp- で始まる", () => {
    expect(newMicropubBodyKey().startsWith("mp-")).toBe(true);
  });

  it("呼ぶたびに違う値になる", () => {
    expect(newMicropubBodyKey()).not.toBe(newMicropubBodyKey());
  });

  it("R2 のキーとして安全な文字だけを使う", () => {
    expect(newMicropubBodyKey()).toMatch(/^mp-[0-9a-f-]+$/);
  });
});

describe("isMicropubBodyKey", () => {
  it("mp- で始まれば true", () => {
    expect(isMicropubBodyKey("mp-abc")).toBe(true);
  });

  it("Scrapbox ID は false", () => {
    expect(isMicropubBodyKey("5f8a1b2c3d4e5f6a7b8c9d0e")).toBe(false);
  });

  it("空文字は false", () => {
    expect(isMicropubBodyKey("")).toBe(false);
  });
});

describe("r2KeyOf", () => {
  it("Scrapbox 由来は .json", () => {
    expect(r2KeyOf("5f8a1b2c")).toBe("5f8a1b2c.json");
  });

  it("Micropub 由来は .html", () => {
    expect(r2KeyOf("mp-0189abcd")).toBe("mp-0189abcd.html");
  });

  it("空文字なら null (本文が存在しない)", () => {
    expect(r2KeyOf("")).toBeNull();
  });

  it("prefix は mp-", () => {
    expect(MICROPUB_PREFIX).toBe("mp-");
  });
});
