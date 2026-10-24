import { describe, expect, it } from "vitest";
import { MAX_THREADS_GRAPHEMES, buildContainerParams } from "./record";
import { countGraphemes } from "../bsky/text";

const G =
  "https://grain.social/profile/did:web:ds.jgs.me/gallery/3mya474kmbdtf";

const base = {
  html: "<p>あいう</p>",
  url: "https://w.jgs.me/p/123",
};

describe("buildContainerParams", () => {
  it("grainUrl があれば text と link_attachment を Grain URL にする", () => {
    const p = buildContainerParams({
      html: '<p><img src="a.png"></p>',
      url: base.url,
      grainUrl: G,
    });
    expect(p).toEqual({ text: G, linkAttachment: G });
  });

  it("grainUrl が null なら今までどおり", () => {
    expect(buildContainerParams({ ...base, grainUrl: null })).toEqual(
      buildContainerParams(base),
    );
  });

  it("本文をプレーンテキストにする", () => {
    const p = buildContainerParams({ ...base, html: "<p>あ</p><p>い</p>" });
    expect(p.text).toBe("あ\n\nい");
  });

  it("link_attachment に共有 URL をそのまま入れる", () => {
    const p = buildContainerParams(base);
    expect(p.linkAttachment).toBe("https://w.jgs.me/p/123");
  });

  it("500 grapheme を超えたら … を付けて切る", () => {
    const p = buildContainerParams({
      ...base,
      html: `<p>${"あ".repeat(600)}</p>`,
    });
    expect(p.text.endsWith("…")).toBe(true);
    expect(countGraphemes(p.text)).toBe(500);
  });

  it("500 grapheme ちょうどなら … を付けない", () => {
    const p = buildContainerParams({
      ...base,
      html: `<p>${"あ".repeat(500)}</p>`,
    });
    expect(p.text.endsWith("…")).toBe(false);
    expect(countGraphemes(p.text)).toBe(500);
  });

  it("絵文字の途中で切らない", () => {
    const p = buildContainerParams({
      ...base,
      html: `<p>${"😀".repeat(600)}</p>`,
    });
    expect(countGraphemes(p.text)).toBe(500);
  });

  it("上限は 500", () => {
    expect(MAX_THREADS_GRAPHEMES).toBe(500);
  });
});

describe("buildContainerParams: ネタバレ", () => {
  it("本文の代わりに題と URL だけを出す", () => {
    const p = buildContainerParams({
      html: "<p>犯人は執事</p>",
      url: "https://w.jgs.me/p/1",
      spoiler: { title: "ミステリの感想" },
    });
    expect(p.text).toBe("ネタバレ注意: ミステリの感想 https://w.jgs.me/p/1");
    expect(p.linkAttachment).toBe("https://w.jgs.me/p/1");
  });
});
