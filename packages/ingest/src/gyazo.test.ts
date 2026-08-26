import { describe, expect, it } from "vitest";
import {
  countScrapboxFiles,
  extractGyazoHashes,
  gyazoRawURL,
  replaceGyazoURLs,
} from "./gyazo";

const A = "0123456789abcdef0123456789abcdef";
const B = "fedcba9876543210fedcba9876543210";

describe("extractGyazoHashes", () => {
  it("素の URL を拾う", () => {
    expect(extractGyazoHashes(`[https://gyazo.com/${A}]`)).toEqual([A]);
  });

  it("/raw /thumb/<n> /max_size/<n> を拾う", () => {
    const text = [
      `https://gyazo.com/${A}/raw`,
      `https://gyazo.com/${B}/thumb/1000`,
      `https://gyazo.com/${A}/max_size/800`,
    ].join("\n");
    expect(extractGyazoHashes(text).sort()).toEqual([A, B].sort());
  });

  it("i.gyazo.com の拡張子付きを拾う", () => {
    expect(extractGyazoHashes(`https://i.gyazo.com/${A}.png`)).toEqual([A]);
  });

  it("重複を潰す", () => {
    const text = `https://gyazo.com/${A} https://gyazo.com/${A}/raw`;
    expect(extractGyazoHashes(text)).toEqual([A]);
  });

  it("Gyazo でない URL を拾わない", () => {
    const text = `https://example.com/${A} https://scrapbox.io/files/${A}.png`;
    expect(extractGyazoHashes(text)).toEqual([]);
  });

  // 32 桁ぴったりで区切る。後ろに hex が続く別物を途中で切らない。
  it("32 桁より長い hex は拾わない", () => {
    expect(extractGyazoHashes(`https://gyazo.com/${A}0`)).toEqual([]);
  });

  it("Gyazo が無ければ空", () => {
    expect(extractGyazoHashes("題\n本文")).toEqual([]);
  });
});

describe("replaceGyazoURLs", () => {
  const resolve = (hash: string) =>
    hash === A ? "https://r2.jgs.me/deadbeef.png" : null;

  it("variant をまとめて置換する", () => {
    const text = [
      `https://gyazo.com/${A}`,
      `https://gyazo.com/${A}/raw`,
      `https://gyazo.com/${A}/thumb/1000`,
      `https://i.gyazo.com/${A}.png`,
    ].join("\n");
    const r = replaceGyazoURLs(text, resolve);
    expect(r.text).toBe(
      Array(4).fill("https://r2.jgs.me/deadbeef.png").join("\n"),
    );
    expect(r.replaced).toBe(4);
    expect(r.skipped).toBe(0);
  });

  // 取り込めなかった画像のリンクを勝手に壊さない。
  it("resolve が null を返した URL は元のまま残す", () => {
    const text = `https://gyazo.com/${A}/raw と https://gyazo.com/${B}/raw`;
    const r = replaceGyazoURLs(text, resolve);
    expect(r.text).toBe(
      `https://r2.jgs.me/deadbeef.png と https://gyazo.com/${B}/raw`,
    );
    expect(r.replaced).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("Gyazo が無ければ何も変えない", () => {
    const r = replaceGyazoURLs("題\n本文", resolve);
    expect(r.text).toBe("題\n本文");
    expect(r.replaced).toBe(0);
    expect(r.skipped).toBe(0);
  });

  // 正規表現の lastIndex を持ち越すと 2 回目が壊れる。
  it("同じ入力を二度呼んでも同じ結果になる", () => {
    const text = `https://gyazo.com/${A}/raw`;
    expect(replaceGyazoURLs(text, resolve)).toEqual(
      replaceGyazoURLs(text, resolve),
    );
  });
});

describe("countScrapboxFiles", () => {
  it("scrapbox.io/files の出現数を数える", () => {
    const text = `https://scrapbox.io/files/${A}.png\nhttps://scrapbox.io/files/${B}`;
    expect(countScrapboxFiles(text)).toBe(2);
  });

  it("無ければ 0", () => {
    expect(countScrapboxFiles(`https://gyazo.com/${A}`)).toBe(0);
  });
});

describe("gyazoRawURL", () => {
  it("原寸の URL を組む", () => {
    expect(gyazoRawURL(A)).toBe(`https://gyazo.com/${A}/raw`);
  });
});
