import { describe, expect, it } from "vitest";
import { buildPostRecord } from "./record";
import { countGraphemes } from "./text";
import type { BlobRef } from "./blob";

const thumb: BlobRef = {
  $type: "blob",
  ref: { $link: "bafkreiexample" },
  mimeType: "image/png",
  size: 12345,
};

const base = {
  title: "テスト記事",
  created: "2024-01-02 03:04:05",
  html: "<p>あいう</p>",
  url: "https://w.jgs.me/pages/%E3%83%86%E3%82%B9%E3%83%88",
  thumb: null,
};

describe("buildPostRecord", () => {
  it("D1 の 'YYYY-MM-DD HH:MM:SS' を ISO 8601 に直す", () => {
    // ATProto の createdAt は datetime 形式を要求する。
    // D1 が返す空白区切りをそのまま渡すと createRecord に弾かれる。
    const r = buildPostRecord(base);
    expect(r.createdAt).toBe("2024-01-02T03:04:05.000Z");
  });

  it("すでに ISO 8601 ならそのまま扱える", () => {
    const r = buildPostRecord({ ...base, created: "2026-08-22T13:21:57.327Z" });
    expect(r.createdAt).toBe("2026-08-22T13:21:57.327Z");
  });

  it("$type と langs を入れる", () => {
    const r = buildPostRecord(base);
    expect(r.$type).toBe("app.bsky.feed.post");
    expect(r.langs).toEqual(["ja"]);
  });

  it("本文をプレーンテキストにする", () => {
    const r = buildPostRecord({ ...base, html: "<p>あ</p><p>い</p>" });
    expect(r.text).toBe("あ\n\nい");
  });

  it("300 grapheme を超えたら … を付けて切る", () => {
    const r = buildPostRecord({ ...base, html: `<p>${"あ".repeat(400)}</p>` });
    const text = r.text as string;
    expect(text.endsWith("…")).toBe(true);
    expect(countGraphemes(text)).toBe(300);
  });

  it("300 grapheme ちょうどなら … を付けない", () => {
    const r = buildPostRecord({ ...base, html: `<p>${"あ".repeat(300)}</p>` });
    const text = r.text as string;
    expect(text.endsWith("…")).toBe(false);
    expect(countGraphemes(text)).toBe(300);
  });

  it("embed に記事の URL とタイトルを入れる", () => {
    const r = buildPostRecord(base);
    const embed = r.embed as {
      $type: string;
      external: Record<string, unknown>;
    };
    expect(embed.$type).toBe("app.bsky.embed.external");
    expect(embed.external.uri).toBe(base.url);
    expect(embed.external.title).toBe("テスト記事");
    expect(embed.external.description).toBe("あいう");
  });

  it("thumb が無いときは external に thumb キーを作らない", () => {
    const r = buildPostRecord(base);
    const embed = r.embed as { external: Record<string, unknown> };
    expect("thumb" in embed.external).toBe(false);
  });

  it("thumb があれば external に入れる", () => {
    const r = buildPostRecord({ ...base, thumb });
    const embed = r.embed as { external: Record<string, unknown> };
    expect(embed.external.thumb).toEqual(thumb);
  });

  it("本文に記事 URL が現れなければ facets を付けない", () => {
    const r = buildPostRecord(base);
    expect("facets" in r).toBe(false);
  });

  it("本文に記事 URL が現れたら facets を付ける", () => {
    const url = "https://w.jgs.me/pages/x";
    const r = buildPostRecord({
      ...base,
      url,
      html: `<p>あ ${url} い</p>`,
    });
    const facets = r.facets as { index: { byteStart: number } }[];
    expect(facets).toHaveLength(1);
    // "あ " は UTF-8 で 4 バイト。
    expect(facets[0]!.index.byteStart).toBe(4);
  });
});
