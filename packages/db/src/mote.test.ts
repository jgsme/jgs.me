import { describe, expect, it } from "vitest";
import { firstMoteUrl, moteApiUrl, parseMoteUrl } from "./mote";

const R = "3mzzs3sn3d22l";
const R2 = "3mzzs3sn3d33l";

describe("parseMoteUrl", () => {
  it("handle の URL を分解する", () =>
    expect(parseMoteUrl(`https://mote.jgs.me/u/ds.jgs.me/${R}`)).toEqual({
      actor: "ds.jgs.me",
      rkey: R,
      url: `https://mote.jgs.me/u/ds.jgs.me/${R}`,
    }));
  it("DID の URL を分解する", () =>
    expect(
      parseMoteUrl(`https://mote.jgs.me/u/did:web:ds.jgs.me/${R}`)?.actor,
    ).toBe("did:web:ds.jgs.me"));
  it("percent-encode された DID を decode する", () =>
    expect(
      parseMoteUrl(`https://mote.jgs.me/u/did%3Aweb%3Ads.jgs.me/${R}`),
    ).toEqual({
      actor: "did:web:ds.jgs.me",
      rkey: R,
      url: `https://mote.jgs.me/u/did:web:ds.jgs.me/${R}`,
    }));
  it("末尾の / と query と hash を落として正規化する", () =>
    expect(
      parseMoteUrl(`https://mote.jgs.me/u/ds.jgs.me/${R}/?a=1#x`)?.url,
    ).toBe(`https://mote.jgs.me/u/ds.jgs.me/${R}`));
  it("ホストの大文字を受ける", () =>
    expect(parseMoteUrl(`https://MOTE.jgs.me/u/ds.jgs.me/${R}`)).toEqual({
      actor: "ds.jgs.me",
      rkey: R,
      url: `https://mote.jgs.me/u/ds.jgs.me/${R}`,
    }));
  it.each([
    `http://mote.jgs.me/u/ds.jgs.me/${R}`, // http
    `https://mote.jgs.me.evil.example/u/a/${R}`, // 別のホスト
    `https://mote.jgs.me/u/ds.jgs.me/nope`, // rkey の形が違う
    `https://mote.jgs.me/u/ds.jgs.me/${R}/x`, // 余分な path
    `https://mote.jgs.me/u/${R}`, // actor が無い
    `https://mote.jgs.me/v1/videos/ds.jgs.me/${R}`, // JSON の URL
    `https://mote.jgs.me/u/%zz/${R}`, // 壊れた percent-encode
    `https://mote.jgs.me/u/a%2Fb/${R}`, // actor に / を含む
    `https://mote.jgs.me/u//${R}`, // actor が空
    "not a url",
  ])("mote のページでない URL は null: %s", (u) =>
    expect(parseMoteUrl(u)).toBeNull(),
  );
});

describe("moteApiUrl", () => {
  it("actor を encode する", () =>
    expect(
      moteApiUrl(parseMoteUrl(`https://mote.jgs.me/u/did:web:ds.jgs.me/${R}`)!),
    ).toBe(`https://mote.jgs.me/v1/videos/did%3Aweb%3Ads.jgs.me/${R}`));
});

describe("firstMoteUrl", () => {
  it("本文の最初の mote を返す", () =>
    expect(
      firstMoteUrl(
        `a\n[https://example.com x]\n[https://mote.jgs.me/u/ds.jgs.me/${R}]\n[https://mote.jgs.me/u/b.test/${R}]`,
      )?.actor,
    ).toBe("ds.jgs.me"));
  it("ラベル付きの mote を拾う", () =>
    expect(
      firstMoteUrl(`[動画 https://mote.jgs.me/u/ds.jgs.me/${R}]`)?.url,
    ).toBe(`https://mote.jgs.me/u/ds.jgs.me/${R}`));
  it("素の URL の mote を拾う", () =>
    expect(
      firstMoteUrl(`見て https://mote.jgs.me/u/ds.jgs.me/${R} これ`)?.rkey,
    ).toBe(R));
  it("装飾の中の mote を拾う", () =>
    expect(
      firstMoteUrl(`[* [https://mote.jgs.me/u/ds.jgs.me/${R2}]]`)?.rkey,
    ).toBe(R2));
  it("コードブロックの中の mote は拾わない", () =>
    expect(
      firstMoteUrl(`code:a\n https://mote.jgs.me/u/ds.jgs.me/${R}\n`),
    ).toBeNull());
  it("コードブロックの後ろの mote は拾う", () =>
    expect(
      firstMoteUrl(
        `code:a\n https://mote.jgs.me/u/x.test/${R}\n[https://mote.jgs.me/u/ds.jgs.me/${R2}]`,
      )?.actor,
    ).toBe("ds.jgs.me"));
  it("mote でないリンクだけの本文は null", () =>
    expect(firstMoteUrl("[https://example.com x]")).toBeNull());
  it("mote の無い本文は null", () =>
    expect(firstMoteUrl("ただの本文")).toBeNull());
  it("空文字は null", () => expect(firstMoteUrl("")).toBeNull());
});
