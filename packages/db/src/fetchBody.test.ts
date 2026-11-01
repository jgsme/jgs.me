import { describe, expect, it, vi } from "vitest";
import { fetchBody, fetchHtmlBody, fetchRenderedHtml } from "./fetchBody";

// get() が返すのは R2ObjectBody の一部だけ使う。必要な口だけ生やす。
const bucketOf = (objects: Record<string, { json?: unknown; text?: string }>) =>
  ({
    get: vi.fn(async (key: string) => {
      const found = objects[key];
      if (!found) return null;
      return {
        json: async () => found.json,
        text: async () => found.text ?? "",
      };
    }),
  }) as unknown as R2Bucket;

describe("fetchBody", () => {
  it("Scrapbox アーカイブは <key>.json の lines を改行で繋ぐ", async () => {
    const r2 = bucketOf({
      "abc123.json": { json: { lines: [{ text: "題" }, { text: "本文" }] } },
    });
    expect(await fetchBody(r2, "abc123", "題")).toBe("題\n本文");
  });

  it("Micropub 由来は <key>.sb を生テキストで返す", async () => {
    const r2 = bucketOf({ "sb-uuid.sb": { text: "題\n本文" } });
    expect(await fetchBody(r2, "sb-uuid", "題")).toBe("題\n本文");
  });

  // 空文字は「本文が存在しない」。R2 を引きに行かせない。
  it("bodyKey が空なら R2 を引かずに null", async () => {
    const r2 = bucketOf({});
    expect(await fetchBody(r2, "", "題")).toBeNull();
    expect(r2.get).not.toHaveBeenCalled();
  });

  it("R2 に無ければ null", async () => {
    const r2 = bucketOf({});
    expect(await fetchBody(r2, "missing", "題")).toBeNull();
    expect(r2.get).toHaveBeenCalledWith("missing.json");
  });
});

describe("standard-html", () => {
  it("fetchBody は <key>.sb を生テキストで返す", async () => {
    expect(
      await fetchBody(
        bucketOf({ "html-1.sb": { text: "題\n本文" } }),
        "html-1",
        "題",
      ),
    ).toBe("題\n本文");
  });
  it("fetchHtmlBody は <key>.html", async () => {
    expect(
      await fetchHtmlBody(
        bucketOf({ "html-1.html": { text: "<p>x</p>" } }),
        "html-1",
      ),
    ).toBe("<p>x</p>");
  });
  it("fetchRenderedHtml は <key>.render.json を読み、形が違えば null", async () => {
    const ok = {
      version: 1,
      head: { links: [], styles: [] },
      body: '<div class="jgs-html-article"></div>',
    };
    expect(
      await fetchRenderedHtml(
        bucketOf({ "html-1.render.json": { json: ok } }),
        "html-1",
      ),
    ).toEqual(ok);
    expect(
      await fetchRenderedHtml(
        bucketOf({ "html-1.render.json": { json: { body: 1 } } }),
        "html-1",
      ),
    ).toBeNull();
  });
  it("R2 に無ければ null", async () => {
    const r2 = bucketOf({});
    expect(await fetchHtmlBody(r2, "html-1")).toBeNull();
    expect(await fetchRenderedHtml(r2, "html-1")).toBeNull();
  });
  it("html 形式でなければ R2 を引かない", async () => {
    const r2 = bucketOf({});
    expect(await fetchHtmlBody(r2, "sb-1")).toBeNull();
    expect(await fetchRenderedHtml(r2, "sb-1")).toBeNull();
    expect(r2.get).not.toHaveBeenCalled();
  });
});
