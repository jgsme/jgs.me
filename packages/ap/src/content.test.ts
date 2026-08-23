import { describe, expect, it } from "vitest";
import { resolveContent } from "./content";

const SITE = "https://w.jgs.me";

// R2Bucket のうち resolveContent が使うのは get だけ。
function fakeR2(objects: Record<string, string>): R2Bucket {
  return {
    get: async (key: string) => {
      if (!(key in objects)) return null;
      const text = objects[key]!;
      return { text: async () => text, json: async () => JSON.parse(text) };
    },
  } as unknown as R2Bucket;
}

describe("resolveContent", () => {
  it("Micropub の .sb は題を落として本文を HTML にする", async () => {
    const r2 = fakeR2({ "sb-1.sb": "題\n本文の1行目\n本文の2行目" });
    const html = await resolveContent("sb-1", r2, SITE, "題");
    expect(html).toBe("<p>本文の1行目</p><p>本文の2行目</p>");
  });

  it("Scrapbox アーカイブの .json も従来通り HTML にする", async () => {
    const r2 = fakeR2({
      "abc.json": JSON.stringify({
        id: "abc",
        title: "題",
        lines: [{ text: "題" }, { text: "本文" }],
      }),
    });
    const html = await resolveContent("abc", r2, SITE, "題");
    expect(html).toBe("<p>本文</p>");
  });

  it("R2 に無ければ空文字", async () => {
    const html = await resolveContent("sb-missing", fakeR2({}), SITE, "題");
    expect(html).toBe("");
  });

  it("bodyKey が空なら空文字", async () => {
    const html = await resolveContent("", fakeR2({}), SITE, "題");
    expect(html).toBe("");
  });
});
