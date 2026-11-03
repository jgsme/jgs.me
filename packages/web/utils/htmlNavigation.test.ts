import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HARD_NAVIGATION_FALLBACK_MS,
  hardNavigateIfLeavingHtmlArticle,
  shouldReloadArticleOnArrival,
  shouldReloadOnArrival,
} from "./htmlNavigation";

describe("shouldReloadOnArrival", () => {
  it("クライアント遷移で来たときだけ読み込み直す", () => {
    expect(shouldReloadOnArrival({ isHydration: false })).toBe(true);
    expect(shouldReloadOnArrival({ isHydration: true })).toBe(false);
    expect(shouldReloadOnArrival({})).toBe(false);
  });
});

describe("shouldReloadArticleOnArrival", () => {
  const xhtm = { type: "codeBlock", fileName: "xhtm" };
  const other = { type: "codeBlock", fileName: "ts" };
  const para = { type: "line" };

  it("xhtm を含む記事にクライアント遷移で来たら読み込み直す", () => {
    expect(
      shouldReloadArticleOnArrival({ isHydration: false }, [para, xhtm]),
    ).toBe(true);
  });

  it("xhtm を含まない記事は読み込み直さない", () => {
    expect(
      shouldReloadArticleOnArrival({ isHydration: false }, [para, other]),
    ).toBe(false);
  });

  it("最初の読み込み (hydration) では読み込み直さない", () => {
    expect(shouldReloadArticleOnArrival({ isHydration: true }, [xhtm])).toBe(
      false,
    );
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

  it("入れ物は .jgs-html-article と .xhtm-host で探す", () => {
    const querySelector = vi.fn(() => null);
    hardNavigateIfLeavingHtmlArticle(
      { querySelector },
      { assign: vi.fn() },
      "/",
    );
    expect(querySelector).toHaveBeenCalledWith(".jgs-html-article, .xhtm-host");
  });

  it("xhtm の入れ物 (.xhtm-host) があっても丸ごと読み込む", () => {
    const assign = vi.fn();
    const querySelector = vi.fn((sel: string) =>
      sel.split(",").some((s) => s.trim() === ".xhtm-host")
        ? ({} as Element)
        : null,
    );
    const result = hardNavigateIfLeavingHtmlArticle(
      { querySelector },
      { assign },
      "/",
      vi.fn(),
    );
    expect(result).toBeInstanceOf(Promise);
    expect(assign).toHaveBeenCalledWith("/");
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
