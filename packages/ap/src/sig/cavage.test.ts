import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair } from "./keys";
import {
  cavageSign,
  cavageSigningString,
  cavageVerify,
  parseCavageHeader,
  DEFAULT_HEADERS,
} from "./cavage";

const TARGET = {
  method: "POST",
  url: "https://mastodon.social/users/Mastodon/inbox",
  headers: {
    host: "mastodon.social",
    date: "Sun, 17 Aug 2026 00:00:00 GMT",
    digest: "SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
  },
};

const KEY_ID = "https://w.jgs.me/ap/actor#main-key";

let priv: CryptoKey;
let pub: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair();
  priv = pair.privateKey;
  pub = pair.publicKey;
});

describe("cavageSigningString", () => {
  it("(request-target) は method とパスだけを小文字で並べる", () => {
    const s = cavageSigningString(TARGET, ["(request-target)"]);
    expect(s).toBe("(request-target): post /users/Mastodon/inbox");
  });

  it("通常のヘッダは name: value になる", () => {
    const s = cavageSigningString(TARGET, ["host", "date"]);
    expect(s).toBe(
      "host: mastodon.social\ndate: Sun, 17 Aug 2026 00:00:00 GMT",
    );
  });

  it("クエリはパスに含める", () => {
    const s = cavageSigningString(
      { ...TARGET, url: "https://example.com/inbox?a=1" },
      ["(request-target)"],
    );
    expect(s).toBe("(request-target): post /inbox?a=1");
  });
});

describe("parseCavageHeader", () => {
  it("4つのフィールドを取り出す", () => {
    const p = parseCavageHeader(
      'keyId="k",algorithm="rsa-sha256",headers="(request-target) host",signature="AAA="',
    );
    expect(p).toEqual({
      keyId: "k",
      algorithm: "rsa-sha256",
      headers: ["(request-target)", "host"],
      signature: "AAA=",
    });
  });

  it("keyId が無ければ null", () => {
    expect(parseCavageHeader('algorithm="rsa-sha256"')).toBeNull();
  });

  it("signature が無ければ null", () => {
    expect(parseCavageHeader('keyId="k",headers="host"')).toBeNull();
  });

  it("headers が無ければ null", () => {
    expect(parseCavageHeader('keyId="k",signature="AAA="')).toBeNull();
  });
});

describe("cavageSign / cavageVerify", () => {
  it("署名して検証すると通る", async () => {
    const h = await cavageSign(TARGET, priv, KEY_ID);
    expect(await cavageVerify(TARGET, pub, h)).toBe(true);
  });

  it("Signature ヘッダに keyId と algorithm が入る", async () => {
    const h = await cavageSign(TARGET, priv, KEY_ID);
    expect(h).toContain(`keyId="${KEY_ID}"`);
    expect(h).toContain('algorithm="rsa-sha256"');
    expect(h).toContain('headers="(request-target) host date digest"');
  });

  it("digest を差し替えると検証に落ちる", async () => {
    const h = await cavageSign(TARGET, priv, KEY_ID);
    const tampered = {
      ...TARGET,
      headers: { ...TARGET.headers, digest: "SHA-256=AAAA" },
    };
    expect(await cavageVerify(tampered, pub, h)).toBe(false);
  });

  it("パスを差し替えると検証に落ちる", async () => {
    const h = await cavageSign(TARGET, priv, KEY_ID);
    const tampered = { ...TARGET, url: "https://mastodon.social/users/other/inbox" };
    expect(await cavageVerify(tampered, pub, h)).toBe(false);
  });

  it("別の鍵では検証に落ちる", async () => {
    const h = await cavageSign(TARGET, priv, KEY_ID);
    const other = await generateKeyPair();
    expect(await cavageVerify(TARGET, other.publicKey, h)).toBe(false);
  });

  it("壊れた Signature ヘッダでは false を返し throw しない", async () => {
    expect(await cavageVerify(TARGET, pub, "garbage")).toBe(false);
  });

  it("DEFAULT_HEADERS は 4 つ", () => {
    expect(DEFAULT_HEADERS).toEqual([
      "(request-target)",
      "host",
      "date",
      "digest",
    ]);
  });
});
