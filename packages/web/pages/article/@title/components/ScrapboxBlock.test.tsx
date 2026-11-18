import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { parse } from "@progfay/scrapbox-parser";
import type { MoteView } from "@/server/mote";
import { MotesContext } from "./Mote";
import { ScrapboxBlock } from "./ScrapboxBlock";

const URL_ = "https://mote.jgs.me/u/jgs.me/3mz7iuy6k2222";

const VIEW: MoteView = {
  pageUrl: URL_,
  videoUrl: "https://mote.jgs.me/v1/videos/jgs.me/3mz7iuy6k2222/video.mp4",
  posterUrl: null,
  aspectRatio: null,
  playback: { autoplay: true, muted: true, loop: false },
  title: null,
  alt: null,
};

const renderLine = (
  text: string,
  props: { photo?: boolean; emphasizeQuote?: boolean } = {},
) => {
  const block = parse(`title\n${text}`)[1];
  if (!block) throw new Error("block expected");
  return renderToString(
    <MotesContext value={{ [URL_]: VIEW }}>
      <ScrapboxBlock block={block} {...props} />
    </MotesContext>,
  );
};

// p の中に div を置くとブラウザが p を閉じ、DOM が SSR の出力とずれる。
describe("ScrapboxBlock の行の入れ物", () => {
  it("装飾の中の mote は p で包まない", () => {
    const html = renderLine(`[* [${URL_}]]`);
    expect(html).toContain("<video");
    expect(html).not.toContain("<p");
  });

  it("番号付きの行の mote は p で包まない", () => {
    const html = renderLine(`1. [${URL_}]`);
    expect(html).toContain("<video");
    expect(html).not.toContain("<p");
  });

  it("装飾の中の YouTube は p で包まない", () => {
    const html = renderLine("[* [https://www.youtube.com/watch?v=abc123]]");
    expect(html).toContain("<iframe");
    expect(html).not.toContain("<p");
  });

  it("埋め込みの無い行は p で包む", () => {
    expect(renderLine("[* ただの行]")).toMatch(/^<p/);
  });
});

describe("strongImage", () => {
  const IMG = "https://r2.jgs.me/a.png";

  it("[[画像URL]] は photo-bleed で包む", () => {
    const html = renderLine(`[[${IMG}]]`);
    expect(html).toContain("photo-bleed");
    expect(html).toContain("<img");
    expect(html).not.toContain("[[");
  });

  it("普通の画像は photo-bleed にしない", () => {
    expect(renderLine(`[${IMG}]`)).not.toContain("photo-bleed");
  });

  it("インデントされた行では --photo-indent を渡す", () => {
    expect(renderLine(`  [[${IMG}]]`)).toContain("--photo-indent:3rem");
  });

  it("引用 clip でも [[画像URL]] は広げる", () => {
    const html = renderLine(`[[${IMG}]]`, { emphasizeQuote: true });
    expect(html).toContain("photo-bleed");
    expect(html).not.toContain("max-w-96");
  });

  it("写真 clip の [[画像URL]] は 1 回だけ包む", () => {
    const html = renderLine(`[[${IMG}]]`, { photo: true });
    expect(html.match(/photo-bleed/g)).toHaveLength(1);
  });

  it("画像でない [[URL]] は太字のリンクのまま", () => {
    const html = renderLine("[[https://example.com/x]]");
    expect(html).not.toContain("photo-bleed");
    expect(html).toContain("<strong");
  });
});

describe("強調の段階", () => {
  it("4 段目以上にも class が付く", () => {
    expect(renderLine("[**** 四]")).toContain(
      'class="text-deco-4-mobile md:text-deco-4 wrap-anywhere"',
    );
  });
  it("* を 11 個書いても 10 段目", () => {
    expect(renderLine("[*********** 十一]")).toContain("md:text-deco-10");
  });
  it("斜体と重ねても両方付く", () => {
    const html = renderLine("[*/ 斜体]");
    expect(html).toContain("text-deco-1-mobile");
    expect(html).toContain("italic");
  });
  it("UI の段の class を使わない", () => {
    const html = renderLine("[*** 三]");
    expect(html).not.toContain("text-3xl");
    expect(html).not.toContain("font-bold");
  });
});

describe("強調を本文幅の外へ広げる", () => {
  it("7 段目だけの行に付く", () => {
    expect(renderLine("[******* 七]")).toMatch(
      /^<p[^>]*class="[^"]*md:deco-bleed md:text-center/,
    );
  });
  it("6 段目には付かない", () => {
    expect(renderLine("[****** 六]")).not.toContain("deco-bleed");
  });
  it("混ざった行には付かない", () => {
    expect(renderLine("前 [******* 七]")).not.toContain("deco-bleed");
  });
});
