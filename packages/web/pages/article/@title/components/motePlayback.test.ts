import { describe, expect, it, vi } from "vitest";
import type { MoteView } from "@/server/mote";
import {
  attachPlayback,
  videoAttrs,
  type PlayableElement,
} from "./motePlayback";

const PAGE = "https://mote.jgs.me/u/jgs.me/3mz7iuy6k2222";

const view = (over: Partial<MoteView> = {}): MoteView => ({
  pageUrl: PAGE,
  videoUrl: "https://mote.jgs.me/v1/videos/jgs.me/3mz7iuy6k2222/video.mp4",
  posterUrl: null,
  aspectRatio: null,
  playback: { autoplay: true, muted: true, loop: false },
  title: null,
  alt: null,
  ...over,
});

describe("videoAttrs", () => {
  it("autoplay の動画は controls 無し・無音・画面に入ったら再生", () => {
    expect(
      videoAttrs(
        view({ playback: { autoplay: true, muted: true, loop: true } }),
      ),
    ).toMatchObject({
      controls: false,
      muted: true,
      loop: true,
      playWhenVisible: true,
      preload: "none",
      playsInline: true,
    });
  });

  it("autoplay でない動画は controls を出す", () => {
    expect(
      videoAttrs(
        view({ playback: { autoplay: false, muted: false, loop: false } }),
      ),
    ).toMatchObject({
      controls: true,
      muted: false,
      loop: false,
      playWhenVisible: false,
    });
  });

  it("autoplay でない動画は record の muted に従う", () => {
    expect(
      videoAttrs(
        view({ playback: { autoplay: false, muted: true, loop: false } }),
      ).muted,
    ).toBe(true);
  });

  it("autoplay なのに muted が false の view でも無音", () => {
    expect(
      videoAttrs(
        view({ playback: { autoplay: true, muted: false, loop: false } }),
      ).muted,
    ).toBe(true);
  });

  it("poster が無ければ undefined", () => {
    expect(videoAttrs(view({ posterUrl: null })).poster).toBeUndefined();
  });

  it("poster と aspectRatio を属性にする", () => {
    expect(
      videoAttrs(
        view({
          posterUrl: "https://p",
          aspectRatio: { width: 720, height: 1280 },
        }),
      ),
    ).toMatchObject({ poster: "https://p", aspectRatio: "720 / 1280" });
  });

  it("aspectRatio が無ければ undefined", () => {
    expect(videoAttrs(view({ aspectRatio: null })).aspectRatio).toBeUndefined();
  });

  it("src は videoUrl", () => {
    expect(videoAttrs(view()).src).toBe(view().videoUrl);
  });
});

type Entries = readonly { readonly isIntersecting: boolean }[];

const fakeElement = (play: () => Promise<void> = async () => {}) => {
  const log: string[] = [];
  let muted = false;
  const el = {
    get muted() {
      return muted;
    },
    set muted(v: boolean) {
      log.push(`muted=${v}`);
      muted = v;
    },
    play: () => {
      log.push(`play muted=${muted}`);
      return play();
    },
    pause: () => void log.push("pause"),
  } as PlayableElement & Element;
  return { el, log };
};

const fakeObserver = () => {
  const state = {
    callback: null as ((entries: Entries) => void) | null,
    observed: [] as unknown[],
    disconnected: 0,
  };
  const Observer = class {
    constructor(cb: (entries: Entries) => void) {
      state.callback = cb;
    }
    observe(target: unknown) {
      state.observed.push(target);
    }
    disconnect() {
      state.disconnected += 1;
    }
  } as unknown as typeof IntersectionObserver;
  const fire = (isIntersecting: boolean) =>
    state.callback?.([{ isIntersecting }]);
  return { Observer, state, fire };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const AUTO = videoAttrs(view());
const MANUAL = (muted: boolean) =>
  videoAttrs(view({ playback: { autoplay: false, muted, loop: false } }));

describe("attachPlayback", () => {
  it("muted を立ててから play を呼ぶ", () => {
    const { el, log } = fakeElement();
    const { Observer, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
    });
    fire(true);
    expect(log).toEqual(["muted=true", "play muted=true"]);
  });

  it("autoplay でない muted の動画は muted を立てるだけで再生しない", () => {
    const { el, log } = fakeElement();
    const { Observer, state } = fakeObserver();
    attachPlayback(el, MANUAL(true), {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
    });
    expect(el.muted).toBe(true);
    expect(log).toEqual(["muted=true"]);
    expect(state.observed).toHaveLength(0);
  });

  it("autoplay でない muted でない動画は muted を落とす", () => {
    const { el } = fakeElement();
    el.muted = true;
    attachPlayback(el, MANUAL(false), {
      IntersectionObserver: fakeObserver().Observer,
      onNeedControls: () => {},
    });
    expect(el.muted).toBe(false);
  });

  it("画面に入ったら play、出たら pause", () => {
    const { el, log } = fakeElement();
    const { Observer, state, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
    });
    expect(state.observed).toEqual([el]);
    fire(true);
    fire(false);
    expect(log.slice(1)).toEqual(["play muted=true", "pause"]);
  });

  it("play が拒否されたら onNeedControls を呼ぶ", async () => {
    const { el } = fakeElement(() =>
      Promise.reject(new DOMException("denied", "NotAllowedError")),
    );
    const { Observer, fire } = fakeObserver();
    const onNeedControls = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls,
    });
    fire(true);
    await flush();
    expect(onNeedControls).toHaveBeenCalledTimes(1);
    expect(el.muted).toBe(true);
  });

  it("IntersectionObserver が無ければ onNeedControls を呼び、再生はしない", () => {
    const { el, log } = fakeElement();
    const onNeedControls = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: undefined,
      onNeedControls,
    });
    expect(onNeedControls).toHaveBeenCalledTimes(1);
    expect(el.muted).toBe(true);
    expect(log).toEqual(["muted=true"]);
  });

  it("autoplay でなければ IntersectionObserver が無くても onNeedControls を呼ばない", () => {
    const { el } = fakeElement();
    const onNeedControls = vi.fn();
    attachPlayback(el, MANUAL(false), {
      IntersectionObserver: undefined,
      onNeedControls,
    });
    expect(onNeedControls).not.toHaveBeenCalled();
  });

  it("片付けで observer を止める", () => {
    const { el } = fakeElement();
    const { Observer, state } = fakeObserver();
    const cleanup = attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
    });
    cleanup();
    expect(state.disconnected).toBe(1);
  });
});
