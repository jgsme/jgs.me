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

const fakeElement = (
  play: () => Promise<void> = async () => {},
  error: unknown = null,
) => {
  const log: string[] = [];
  let muted = false;
  const el = {
    error,
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
      onFailed: () => {},
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
      onFailed: () => {},
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
      onFailed: () => {},
    });
    expect(el.muted).toBe(false);
  });

  it("画面に入ったら play、出たら pause", () => {
    const { el, log } = fakeElement();
    const { Observer, state, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
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
      onFailed: () => {},
    });
    fire(true);
    await flush();
    expect(onNeedControls).toHaveBeenCalledTimes(1);
    expect(el.muted).toBe(true);
  });

  it("自分の pause で中断された play (AbortError) では onNeedControls を呼ばない", async () => {
    const { el } = fakeElement(() =>
      Promise.reject(new DOMException("interrupted", "AbortError")),
    );
    const { Observer, fire } = fakeObserver();
    const onNeedControls = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls,
      onFailed: () => {},
    });
    fire(true);
    await flush();
    expect(onNeedControls).not.toHaveBeenCalled();
  });

  it("AbortError のあとも observer は付いたまま", async () => {
    const { el } = fakeElement(() =>
      Promise.reject(new DOMException("interrupted", "AbortError")),
    );
    const { Observer, state, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
    });
    fire(true);
    await flush();
    expect(state.disconnected).toBe(0);
  });

  it("AbortError のあと画面に入り直したら play を呼ぶ", async () => {
    const { el, log } = fakeElement(() =>
      Promise.reject(new DOMException("interrupted", "AbortError")),
    );
    const { Observer, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
    });
    fire(true);
    await flush();
    fire(false);
    fire(true);
    await flush();
    expect(log.filter((l) => l.startsWith("play"))).toHaveLength(2);
  });

  it("play が拒否されたら observer を外す", async () => {
    const { el } = fakeElement(() =>
      Promise.reject(new DOMException("denied", "NotAllowedError")),
    );
    const { Observer, state, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
    });
    fire(true);
    await flush();
    expect(state.disconnected).toBe(1);
  });

  it("play が拒否されたあとは画面に入り直しても play を呼ばない", async () => {
    const { el, log } = fakeElement(() =>
      Promise.reject(new DOMException("denied", "NotAllowedError")),
    );
    const { Observer, fire } = fakeObserver();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
    });
    fire(true);
    await flush();
    // 本物の observer は disconnect 後に呼ばれない。fake は呼べてしまうので
    // 呼ばれても play しないことまで確かめる。
    fire(true);
    await flush();
    expect(log.filter((l) => l.startsWith("play"))).toHaveLength(1);
  });

  it("hydration より前に読み込みに失敗していたら onFailed を呼び、再生しない", () => {
    const { el, log } = fakeElement(async () => {}, { code: 4 });
    const { Observer, state } = fakeObserver();
    const onFailed = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed,
    });
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(state.observed).toHaveLength(0);
    expect(log.filter((l) => l.startsWith("play"))).toHaveLength(0);
  });

  it("読み込みに失敗していなければ onFailed を呼ばない", () => {
    const { el } = fakeElement();
    const onFailed = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: fakeObserver().Observer,
      onNeedControls: () => {},
      onFailed,
    });
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("IntersectionObserver が無ければ onNeedControls を呼び、再生はしない", () => {
    const { el, log } = fakeElement();
    const onNeedControls = vi.fn();
    attachPlayback(el, AUTO, {
      IntersectionObserver: undefined,
      onNeedControls,
      onFailed: () => {},
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
      onFailed: () => {},
    });
    expect(onNeedControls).not.toHaveBeenCalled();
  });

  it("片付けで observer を止める", () => {
    const { el } = fakeElement();
    const { Observer, state } = fakeObserver();
    const cleanup = attachPlayback(el, AUTO, {
      IntersectionObserver: Observer,
      onNeedControls: () => {},
      onFailed: () => {},
    });
    cleanup();
    expect(state.disconnected).toBe(1);
  });
});
