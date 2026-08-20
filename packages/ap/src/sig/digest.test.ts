import { describe, expect, it } from "vitest";
import { sha256Digest, verifyDigest } from "./digest";

// 空文字の SHA-256 は既知の値。実装が本当にハッシュしているかを固定値で確かめる。
const EMPTY_SHA256 = "SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

describe("sha256Digest", () => {
  it("SHA-256= の prefix 付きで base64 を返す", async () => {
    expect(await sha256Digest("")).toBe(EMPTY_SHA256);
  });

  it("内容が変わればダイジェストも変わる", async () => {
    const a = await sha256Digest("a");
    const b = await sha256Digest("b");
    expect(a).not.toBe(b);
  });

  it("UTF-8 のマルチバイトを正しく扱う", async () => {
    const d = await sha256Digest("あ");
    expect(d.startsWith("SHA-256=")).toBe(true);
    expect(d).not.toBe(await sha256Digest("a"));
  });
});

describe("verifyDigest", () => {
  it("一致すれば true", async () => {
    const body = '{"type":"Follow"}';
    expect(await verifyDigest(body, await sha256Digest(body))).toBe(true);
  });

  it("body が改竄されていれば false", async () => {
    const d = await sha256Digest('{"type":"Follow"}');
    expect(await verifyDigest('{"type":"Delete"}', d)).toBe(false);
  });

  it("ヘッダが無ければ false", async () => {
    expect(await verifyDigest("x", null)).toBe(false);
  });

  it("アルゴリズムが SHA-256 でなければ false", async () => {
    expect(await verifyDigest("", "SHA-512=abc")).toBe(false);
  });
});
