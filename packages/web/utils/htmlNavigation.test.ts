import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HARD_NAVIGATION_FALLBACK_MS,
  hardNavigateIfDraftTransition,
  hardNavigateIfLeavingHtmlArticle,
  shouldReloadOnArrival,
} from "./htmlNavigation";

describe("shouldReloadOnArrival", () => {
  it("クライアント遷移で来たときだけ読み込み直す", () => {
    expect(shouldReloadOnArrival({ isHydration: false })).toBe(true);
    expect(shouldReloadOnArrival({ isHydration: true })).toBe(false);
    expect(shouldReloadOnArrival({})).toBe(false);
  });
});

describe("hardNavigateIfLeavingHtmlArticle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const settled = async (p: Promise<void>): Promise<boolean> => {
    let done = false;
    void p.then(() => {
      done = true;
    });
    await Promise.resolve();
    return done;
  };

  it("HTML article から出る遷移は丸ごと読み込み、Vike の描画を止める", async () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    const result = hardNavigateIfLeavingHtmlArticle(
      { querySelector: () => ({}) as Element },
      { assign },
      "/pages/%E6%AC%A1",
    );
    expect(result).toBeInstanceOf(Promise);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/pages/%E6%AC%A1");
    vi.advanceTimersByTime(HARD_NAVIGATION_FALLBACK_MS - 1);
    expect(await settled(result!)).toBe(false);
  });

  it("10 秒経っても document が残っていたら Vike に返す", async () => {
    vi.useFakeTimers();
    const result = hardNavigateIfLeavingHtmlArticle(
      { querySelector: () => ({}) as Element },
      { assign: vi.fn() },
      "/",
    );
    expect(HARD_NAVIGATION_FALLBACK_MS).toBe(10_000);
    vi.advanceTimersByTime(HARD_NAVIGATION_FALLBACK_MS);
    await expect(result).resolves.toBeUndefined();
  });

  it("timer は差し替えられる", () => {
    const setTimer = vi.fn();
    hardNavigateIfLeavingHtmlArticle(
      { querySelector: () => ({}) as Element },
      { assign: vi.fn() },
      "/",
      setTimer,
    );
    expect(setTimer).toHaveBeenCalledWith(
      expect.any(Function),
      HARD_NAVIGATION_FALLBACK_MS,
    );
  });

  it("入れ物は .jgs-html-article で探す", () => {
    const querySelector = vi.fn(() => null);
    hardNavigateIfLeavingHtmlArticle(
      { querySelector },
      { assign: vi.fn() },
      "/",
    );
    expect(querySelector).toHaveBeenCalledWith(".jgs-html-article");
  });

  it("それ以外のページからの遷移は Vike に任せる", () => {
    const assign = vi.fn();
    expect(
      hardNavigateIfLeavingHtmlArticle(
        { querySelector: () => null },
        { assign },
        "/",
      ),
    ).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("hardNavigateIfDraftTransition", () => {
  const KEY = "A".repeat(43);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("draft へ入る遷移は丸ごと読み込む (gtag を先に読んだ document に鍵入りの URL を載せない)", () => {
    const assign = vi.fn();
    const result = hardNavigateIfDraftTransition(
      { assign, pathname: "/" },
      `/drafts/${KEY}`,
    );
    expect(result).toBeInstanceOf(Promise);
    expect(assign).toHaveBeenCalledWith(`/drafts/${KEY}`);
  });

  it("draft から出る遷移も丸ごと読み込む", () => {
    const assign = vi.fn();
    const result = hardNavigateIfDraftTransition(
      { assign, pathname: `/drafts/${KEY}` },
      "/pages/%E9%A1%8C",
    );
    expect(result).toBeInstanceOf(Promise);
    expect(assign).toHaveBeenCalledWith("/pages/%E9%A1%8C");
  });

  it("クエリ付きの urlOriginal でも draft と判る", () => {
    const assign = vi.fn();
    hardNavigateIfDraftTransition(
      { assign, pathname: "/" },
      `/drafts/${KEY}?x=1`,
    );
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("10 秒経っても document が残っていたら Vike に返す", async () => {
    vi.useFakeTimers();
    const result = hardNavigateIfDraftTransition(
      { assign: vi.fn(), pathname: "/" },
      `/drafts/${KEY}`,
    );
    vi.advanceTimersByTime(HARD_NAVIGATION_FALLBACK_MS);
    await expect(result).resolves.toBeUndefined();
  });

  it("draft と関係ない遷移は Vike に任せる (/draftsx も draft ではない)", () => {
    const assign = vi.fn();
    expect(
      hardNavigateIfDraftTransition({ assign, pathname: "/" }, "/pages/x"),
    ).toBeUndefined();
    expect(
      hardNavigateIfDraftTransition({ assign, pathname: "/" }, "/draftsx"),
    ).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
  });
});
