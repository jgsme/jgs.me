import { describe, expect, it } from "vitest";
import {
  exportPublicPem,
  generateKeyPair,
  importPrivateKey,
  importPublicKey,
  normalizePublicPem,
} from "./keys";

// Mastodon の実鍵 (https://mastodon.social/users/Mastodon#main-key) と同じ形式。
// SPKI PEM が import できることが actor の公開鍵を検証できる前提になる。
const SPKI_HEADER = "-----BEGIN PUBLIC KEY-----";
const PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";

describe("鍵の生成と往復", () => {
  it("RSA-2048 の鍵ペアを作れる", async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    expect(privateKey.algorithm.name).toBe("RSASSA-PKCS1-v1_5");
    expect((publicKey.algorithm as RsaHashedKeyAlgorithm).modulusLength).toBe(
      2048,
    );
  });

  it("公開鍵を SPKI PEM に書き出せる", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    expect(pem.startsWith(SPKI_HEADER)).toBe(true);
    expect(pem.trimEnd().endsWith("-----END PUBLIC KEY-----")).toBe(true);
  });

  it("書き出した PEM を読み戻せる", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    const reimported = await importPublicKey(pem);
    expect(reimported.type).toBe("public");
    expect(reimported.usages).toContain("verify");
  });

  it("PEM のヘッダと改行が混ざっていても読める", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    const messy = pem.replace(/\n/g, "\r\n") + "\n\n";
    const reimported = await importPublicKey(messy);
    expect(reimported.type).toBe("public");
  });

  it("秘密鍵を PKCS8 PEM 経由で読み戻せる", async () => {
    const { privateKey } = await generateKeyPair();
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
    let bin = "";
    for (const b of new Uint8Array(pkcs8)) bin += String.fromCharCode(b);
    const b64 = btoa(bin);
    const pem = `${PKCS8_HEADER}\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
    const reimported = await importPrivateKey(pem);
    expect(reimported.type).toBe("private");
    expect(reimported.usages).toContain("sign");
  });

  it("壊れた PEM は throw する", async () => {
    await expect(importPublicKey("not a pem")).rejects.toThrow();
  });
});

// Secrets への投入時に改行が潰れることが実際に起きた。
// actor の publicKeyPem は生で相手に渡るので、どう入っていても
// 正しい PEM に直してから出す。
describe("normalizePublicPem", () => {
  it("正しい PEM はそのまま", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    expect(normalizePublicPem(pem)).toBe(pem);
  });

  it("改行がスペースに潰れた PEM を直せる", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    expect(normalizePublicPem(pem.replace(/\n/g, " "))).toBe(pem);
  });

  it("ヘッダとフッタが落ちた base64 だけでも直せる", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    const bodyOnly = pem
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s+/g, " ")
      .trim();
    expect(normalizePublicPem(bodyOnly)).toBe(pem);
  });

  it("直した PEM は import できる", async () => {
    const { publicKey } = await generateKeyPair();
    const pem = await exportPublicPem(publicKey);
    const fixed = normalizePublicPem(pem.replace(/\n/g, " "));
    expect((await importPublicKey(fixed)).type).toBe("public");
  });

  it("空文字は throw する", () => {
    expect(() => normalizePublicPem("")).toThrow();
  });
});
