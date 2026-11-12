import { describe, expect, it } from "vitest";
import { firstMoteUrl } from "./firstMote";

const R = "3mzzs3sn3d22l";
const R2 = "3mzzs3sn3d33l";

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
  it("番号付きの行の mote を拾う", () =>
    expect(
      firstMoteUrl(`1. [https://mote.jgs.me/u/ds.jgs.me/${R}]`)?.rkey,
    ).toBe(R));
  // 表のセルは parser がリンクにしないので、本文でも埋め込みにならない。
  it("表の中の mote は拾わない", () =>
    expect(
      firstMoteUrl(`table:t\n a\t[https://mote.jgs.me/u/ds.jgs.me/${R}]\n`),
    ).toBeNull());
});
