import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { parse } from "@progfay/scrapbox-parser";
import type { Motes, MoteView } from "@/server/mote";
import { MoteEmbed, MoteLink, MotesContext } from "./Mote";
import { ScrapboxNode } from "./ScrapboxNode";

const URL_ = "https://mote.jgs.me/u/jgs.me/3mz7iuy6k2222";

const VIEW: MoteView = {
  pageUrl: URL_,
  videoUrl: "https://mote.jgs.me/v1/videos/jgs.me/3mz7iuy6k2222/video.mp4",
  posterUrl: "https://mote.jgs.me/v1/videos/jgs.me/3mz7iuy6k2222/poster",
  aspectRatio: { width: 720, height: 1280 },
  playback: { autoplay: true, muted: true, loop: false },
  title: "朝の散歩",
  alt: "川沿いの道",
};

const render = (motes: Motes, view?: Partial<MoteView>) =>
  renderToString(
    <MotesContext value={view ? { [URL_]: { ...VIEW, ...view } } : motes}>
      <MoteLink url={URL_} href={URL_} label={URL_} />
    </MotesContext>,
  );

describe("MoteLink", () => {
  it("view があれば video を描く", () => {
    const html = render({ [URL_]: VIEW });
    expect(html).toContain("<video");
    expect(html).toContain(`src="${VIEW.videoUrl}"`);
    expect(html).toContain('preload="none"');
    expect(html).not.toMatch(/\sautoplay/i);
  });

  it("poster を属性にする", () => {
    expect(render({ [URL_]: VIEW })).toContain(`poster="${VIEW.posterUrl}"`);
  });

  it("aspectRatio を SSR の style で確保する", () => {
    expect(render({ [URL_]: VIEW })).toContain("aspect-ratio:720 / 1280");
  });

  it("縦長でも高さを画面の 8 割に収める", () => {
    expect(render({ [URL_]: VIEW })).toContain("max-height:80vh");
  });

  it("autoplay の動画の HTML に controls は無い", () => {
    expect(render({ [URL_]: VIEW })).not.toContain("controls");
  });

  it("autoplay の動画は playsinline で loop が無ければ loop 属性を出さない", () => {
    const html = render({ [URL_]: VIEW });
    expect(html).toMatch(/playsinline/i);
    expect(html).not.toMatch(/\sloop/);
  });

  it("loop: true なら loop を出す", () => {
    const html = render(
      {},
      { playback: { autoplay: true, muted: true, loop: true } },
    );
    expect(html).toMatch(/\sloop/);
  });

  it("autoplay でない動画の HTML に controls がある", () => {
    const html = render(
      {},
      { playback: { autoplay: false, muted: false, loop: false } },
    );
    expect(html).toContain("controls");
    expect(html).toMatch(/playsinline/i);
    expect(html).toContain('preload="none"');
    expect(html).not.toMatch(/\sautoplay/i);
  });

  it("alt が aria-label に入る", () => {
    expect(render({ [URL_]: VIEW })).toContain('aria-label="川沿いの道"');
  });

  it("alt が無ければ aria-label を出さない", () => {
    expect(render({}, { alt: null })).not.toContain("aria-label");
  });

  it("aspectRatio が無ければ style の aspect-ratio を出さず、高さの上限は残す", () => {
    const html = render({}, { aspectRatio: null });
    expect(html).not.toContain("aspect-ratio");
    expect(html).toContain("max-height:80vh");
  });

  it("autoplay の動画の HTML は muted", () => {
    expect(render({ [URL_]: VIEW })).toMatch(/\smuted/);
  });

  it("autoplay の動画は record の muted が false でも HTML は muted", () => {
    const html = render(
      {},
      { playback: { autoplay: true, muted: false, loop: false } },
    );
    expect(html).toMatch(/\smuted/);
  });

  it("autoplay でなく muted が false の動画の HTML は muted でない", () => {
    const html = render(
      {},
      { playback: { autoplay: false, muted: false, loop: false } },
    );
    expect(html).not.toMatch(/\smuted/);
  });

  it("MoteEmbed に videoUrl を key として付ける", () => {
    let element: React.ReactElement | null = null;
    const Probe = () => {
      element = MoteLink({
        url: URL_,
        href: URL_,
        label: URL_,
      }) as React.ReactElement | null;
      return null;
    };
    renderToString(
      <MotesContext value={{ [URL_]: VIEW }}>
        <Probe />
      </MotesContext>,
    );
    expect(element).not.toBeNull();
    expect(element!.type).toBe(MoteEmbed);
    expect(element!.key).toBe(VIEW.videoUrl);
  });

  it("view が無ければリンクを描く", () => {
    const html = render({});
    expect(html).not.toContain("<video");
    expect(html).toContain(`href="${URL_}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">" + URL_ + "</a>");
  });
});

describe("ScrapboxNode", () => {
  const nodeOf = (text: string) => {
    const block = parse(`title\n${text}`)[1];
    if (block?.type !== "line") throw new Error("line expected");
    const node = block.nodes[0];
    if (!node) throw new Error("node expected");
    return node;
  };

  it("mote の link を MoteLink で描く", () => {
    const html = renderToString(
      <MotesContext value={{ [URL_]: VIEW }}>
        <ScrapboxNode node={nodeOf(`[${URL_}]`)} />
      </MotesContext>,
    );
    expect(html).toContain("<video");
  });

  it("mote の view が無ければリンクのまま描く", () => {
    const html = renderToString(<ScrapboxNode node={nodeOf(`[${URL_}]`)} />);
    expect(html).not.toContain("<video");
    expect(html).toContain(`href="${URL_}"`);
  });

  it("mote でない link を今までどおり描く", () => {
    const html = renderToString(
      <MotesContext value={{ [URL_]: VIEW }}>
        <ScrapboxNode node={nodeOf("[https://example.com/x 例]")} />
      </MotesContext>,
    );
    expect(html).not.toContain("<video");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain(">例</a>");
  });
});
