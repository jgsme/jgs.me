import { describe, expect, it } from "vitest";
import { ogImageURL, safeHref, sourceLink } from "./page";

const ID = "a".repeat(64);

describe("ogImageURL", () => {
  // 元画像が大きいと unfurl 側が諦める (X は 5MB 上限)。変換を噛ませる。
  it("Image Transformations を経由した URL を返す", () => {
    expect(ogImageURL(ID, "png")).toBe(
      `https://r2.jgs.me/cdn-cgi/image/width=1200,format=auto,onerror=redirect/${ID}.png`,
    );
  });
});

describe("safeHref", () => {
  it("http/https はそのまま通す", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("http://example.com/a")).toBe("http://example.com/a");
  });

  // 出典 URL は他所のページ由来。javascript: を href に出すとクリックで実行される。
  it("javascript: は落とす", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
  });

  it("data: は落とす", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("URL として壊れていれば落とす", () => {
    expect(safeHref("h ttp://x")).toBeNull();
  });

  it("null は null", () => {
    expect(safeHref(null)).toBeNull();
  });
});

describe("sourceLink", () => {
  it("題があればそれをラベルにする", () => {
    expect(sourceLink("https://example.com/x", "元記事")).toEqual({
      href: "https://example.com/x",
      label: "元記事",
    });
  });

  // 題が無いときの "jgs.me" は og:title 用のフォールバックで、出典リンクの
  // ラベルに使うと example.com へのリンクなのに自サイトを名乗る嘘になる。
  it("題が無ければホスト名をラベルにする", () => {
    expect(sourceLink("https://example.com/x", null)).toEqual({
      href: "https://example.com/x",
      label: "example.com",
    });
  });

  it("javascript: の出典はリンクにしない", () => {
    expect(sourceLink("javascript:alert(1)", "元記事")).toBeNull();
  });

  it("出典が無ければ null", () => {
    expect(sourceLink(null, null)).toBeNull();
  });
});
