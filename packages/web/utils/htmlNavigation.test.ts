import { describe, expect, it, vi } from "vitest";
import {
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
  it("HTML article から出る遷移は丸ごと読み込む", () => {
    const assign = vi.fn();
    expect(
      hardNavigateIfLeavingHtmlArticle(
        { querySelector: () => ({}) as Element },
        { assign },
        "/pages/%E6%AC%A1",
      ),
    ).toBe(true);
    expect(assign).toHaveBeenCalledWith("/pages/%E6%AC%A1");
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
    ).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
