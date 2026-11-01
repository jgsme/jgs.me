import { describe, expect, it } from "vitest";
import { resolveContent, resolveOutlinkHtml } from "./content";

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

describe("standard-html", () => {
  it("standard-html の .sb は Scrapbox 記法として読まず、行ごとにエスケープした段落にする", async () => {
    const r2 = fakeR2({ "html-1.sb": "題\n配列 [a] と #1 <b>\n\n`x` code:y" });
    expect(await resolveContent("html-1", r2, SITE, "題")).toBe(
      "<p>配列 [a] と #1 &lt;b&gt;</p><p>`x` code:y</p>",
    );
  });
});

describe("resolveOutlinkHtml", () => {
  it("Webmention の元は standard-html なら原本 HTML", async () => {
    expect(
      await resolveOutlinkHtml(
        "html-1",
        fakeR2({ "html-1.html": '<a href="https://ex.com/">x</a>' }),
        "<p>派生</p>",
      ),
    ).toBe('<a href="https://ex.com/">x</a>');
  });
  it("原本が無ければ空文字", async () => {
    expect(await resolveOutlinkHtml("html-1", fakeR2({}), "<p>派生</p>")).toBe(
      "",
    );
  });
  it("それ以外の形式は描いた本文をそのまま返す", async () => {
    expect(await resolveOutlinkHtml("sb-1", fakeR2({}), "<p>本文</p>")).toBe(
      "<p>本文</p>",
    );
  });
});
