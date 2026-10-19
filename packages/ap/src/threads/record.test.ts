import { describe, expect, it } from "vitest";
import {
  MAX_THREADS_GRAPHEMES,
  buildContainerParams,
  buildGrainContainerParams,
} from "./record";
import { countGraphemes } from "../bsky/text";

const base = {
  html: "<p>あいう</p>",
  url: "https://w.jgs.me/p/123",
};

describe("buildContainerParams", () => {
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

describe("buildGrainContainerParams", () => {
  const grainURL = "https://grain.social/profile/ds.jgs.me/gallery/r";

  it("題が無ければ URL だけを本文にする", () => {
    expect(buildGrainContainerParams({ title: null, grainURL })).toEqual({
      text: grainURL,
      linkAttachment: grainURL,
    });
  });

  it("題があれば前に置く", () => {
    expect(buildGrainContainerParams({ title: "夕焼け", grainURL })).toEqual({
      text: `夕焼け\n${grainURL}`,
      linkAttachment: grainURL,
    });
  });

  it("空白だけの題は無いものとする", () => {
    expect(buildGrainContainerParams({ title: "  ", grainURL }).text).toBe(
      grainURL,
    );
  });
});
