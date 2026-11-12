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

const renderLine = (text: string) => {
  const block = parse(`title\n${text}`)[1];
  if (!block) throw new Error("block expected");
  return renderToString(
    <MotesContext value={{ [URL_]: VIEW }}>
      <ScrapboxBlock block={block} />
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
