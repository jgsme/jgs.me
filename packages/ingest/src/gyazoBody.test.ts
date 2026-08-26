import { describe, expect, it } from "vitest";
import { bodyContentType, bodyTextOf, rewriteBody } from "./gyazoBody";

const A = "0123456789abcdef0123456789abcdef";
const R2 = "https://r2.jgs.me/deadbeef.png";
const resolve = (hash: string) => (hash === A ? R2 : null);

// Scrapbox アーカイブは 1 行が text 以外のフィールドも持つ。
const archive = JSON.stringify({
  id: "sbid",
  title: "題",
  created: 1600000000,
  lines: [
    { id: "l0", text: "題", userId: "u1" },
    { id: "l1", text: `[https://gyazo.com/${A}/raw]`, userId: "u1" },
    { id: "l2", text: "本文", userId: "u1" },
  ],
});

const sb = `題\n[https://gyazo.com/${A}/raw]\n本文`;

describe("bodyTextOf", () => {
  it(".json は lines[].text を改行で繋ぐ", () => {
    expect(bodyTextOf("sbid", archive)).toBe(
      `題\n[https://gyazo.com/${A}/raw]\n本文`,
    );
  });

  it(".sb は生テキストをそのまま返す", () => {
    expect(bodyTextOf("sb-uuid", sb)).toBe(sb);
  });
});

describe("rewriteBody", () => {
  it(".json は lines[].text 以外のフィールドを保つ", () => {
    const r = rewriteBody("sbid", archive, resolve);
    const data = JSON.parse(r.raw);
    expect(data.id).toBe("sbid");
    expect(data.title).toBe("題");
    expect(data.created).toBe(1600000000);
    expect(data.lines[1]).toEqual({ id: "l1", text: `[${R2}]`, userId: "u1" });
    expect(r.replaced).toBe(1);
    expect(r.skipped).toBe(0);
  });

  // 1 行目が題という不変条件を壊さない。
  it(".json は 1 行目を触らない", () => {
    const data = JSON.parse(rewriteBody("sbid", archive, resolve).raw);
    expect(data.lines[0].text).toBe("題");
  });

  it(".sb は生テキストを置換して 1 行目を残す", () => {
    const r = rewriteBody("sb-uuid", sb, resolve);
    expect(r.raw).toBe(`題\n[${R2}]\n本文`);
    expect(r.raw.split("\n")[0]).toBe("題");
    expect(r.replaced).toBe(1);
  });

  it("対応表に無いハッシュは触らず skipped に数える", () => {
    const other = "fedcba9876543210fedcba9876543210";
    const text = `題\nhttps://gyazo.com/${other}/raw`;
    const r = rewriteBody("sb-uuid", text, resolve);
    expect(r.raw).toBe(text);
    expect(r.replaced).toBe(0);
    expect(r.skipped).toBe(1);
  });
});

describe("bodyContentType", () => {
  it(".json は application/json", () => {
    expect(bodyContentType("sbid")).toBe("application/json");
  });

  it(".sb は text/plain", () => {
    expect(bodyContentType("sb-uuid")).toBe("text/plain; charset=utf-8");
  });
});
