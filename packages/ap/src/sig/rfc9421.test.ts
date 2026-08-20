import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair } from "./keys";
import {
  DEFAULT_COMPONENTS,
  rfc9421Base,
  rfc9421Sign,
  rfc9421Verify,
} from "./rfc9421";

const TARGET = {
  method: "POST",
  url: "https://mastodon.social/users/Mastodon/inbox",
  headers: {
    host: "mastodon.social",
    date: "Sun, 17 Aug 2026 00:00:00 GMT",
    digest: "SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
  },
};

const PARAMS = {
  created: 1755400000,
  keyid: "https://w.jgs.me/ap/actor#main-key",
  alg: "rsa-v1_5-sha256",
};

let priv: CryptoKey;
let pub: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair();
  priv = pair.privateKey;
  pub = pair.publicKey;
});

describe("rfc9421Base", () => {
  it("派生コンポーネントを展開する", () => {
    const { base } = rfc9421Base(TARGET, ["@method", "@target-uri"], PARAMS);
    expect(base).toContain('"@method": POST');
    expect(base).toContain(
      '"@target-uri": https://mastodon.social/users/Mastodon/inbox',
    );
  });

  it("通常のヘッダを展開する", () => {
    const { base } = rfc9421Base(TARGET, ["host"], PARAMS);
    expect(base).toContain('"host": mastodon.social');
  });

  it("最後の行が @signature-params になる", () => {
    const { base, inner } = rfc9421Base(TARGET, ["@method"], PARAMS);
    expect(base.split("\n").at(-1)).toBe(`"@signature-params": ${inner}`);
  });

  it("inner に created / keyid / alg が入る", () => {
    const { inner } = rfc9421Base(TARGET, ["@method"], PARAMS);
    expect(inner).toBe(
      '("@method");created=1755400000;keyid="https://w.jgs.me/ap/actor#main-key";alg="rsa-v1_5-sha256"',
    );
  });
});

describe("rfc9421Sign / rfc9421Verify", () => {
  it("署名して検証すると通る", async () => {
    const h = await rfc9421Sign(TARGET, priv, PARAMS);
    expect(await rfc9421Verify(TARGET, pub, h)).toBe(true);
  });

  it("Signature-Input と Signature の2ヘッダを返す", async () => {
    const h = await rfc9421Sign(TARGET, priv, PARAMS);
    expect(h["Signature-Input"].startsWith("sig1=(")).toBe(true);
    expect(h.Signature.startsWith("sig1=:")).toBe(true);
    expect(h.Signature.endsWith(":")).toBe(true);
  });

  it("digest を差し替えると検証に落ちる", async () => {
    const h = await rfc9421Sign(TARGET, priv, PARAMS);
    const tampered = {
      ...TARGET,
      headers: { ...TARGET.headers, digest: "SHA-256=AAAA" },
    };
    expect(await rfc9421Verify(tampered, pub, h)).toBe(false);
  });

  it("別の鍵では検証に落ちる", async () => {
    const h = await rfc9421Sign(TARGET, priv, PARAMS);
    const other = await generateKeyPair();
    expect(await rfc9421Verify(TARGET, other.publicKey, h)).toBe(false);
  });

  it("壊れたヘッダでは false を返し throw しない", async () => {
    expect(
      await rfc9421Verify(TARGET, pub, {
        "Signature-Input": "garbage",
        Signature: "garbage",
      }),
    ).toBe(false);
  });

  it("DEFAULT_COMPONENTS は 5 つ", () => {
    expect(DEFAULT_COMPONENTS).toEqual([
      "@method",
      "@target-uri",
      "host",
      "date",
      "digest",
    ]);
  });
});
