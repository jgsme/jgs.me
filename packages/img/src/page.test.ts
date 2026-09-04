import { describe, expect, it } from "vitest";
import { ogImageURL, renderPage, safeHref, type SharedImageView } from "./page";

const ID = "a".repeat(64);

function view(over: Partial<SharedImageView> = {}): SharedImageView {
  return {
    id: ID,
    ext: "png",
    sourceURL: "https://example.com/article",
    sourceTitle: "元記事",
    width: 1200,
    height: 800,
    created: "2026-09-04 12:00:00",
    ...over,
  };
}

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

describe("renderPage", () => {
  it("og:image と寸法を出す", () => {
    const html = renderPage(view());
    expect(html).toContain(
      `<meta property="og:image" content="https://r2.jgs.me/cdn-cgi/image/width=1200,format=auto,onerror=redirect/${ID}.png">`,
    );
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="800">');
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image">',
    );
  });

  it("寸法が無ければ width/height の meta を出さない", () => {
    const html = renderPage(view({ width: null, height: null }));
    expect(html).not.toContain("og:image:width");
    expect(html).not.toContain("og:image:height");
  });

  it("source_title が無ければ og:title は jgs.me", () => {
    expect(renderPage(view({ sourceTitle: null }))).toContain(
      '<meta property="og:title" content="jgs.me">',
    );
  });

  // 他所のページのタイトルがそのまま属性値に入ると、" で属性を閉じて
  // 任意のタグを差し込める。
  it("タイトルの引用符と山括弧をエスケープする", () => {
    const html = renderPage(
      view({ sourceTitle: '"><script>alert(1)</script>' }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("javascript: の出典 URL はリンクにしない", () => {
    const html = renderPage(view({ sourceURL: "javascript:alert(1)" }));
    expect(html).not.toContain("javascript:");
  });

  it("画像の直リンクを出す", () => {
    expect(renderPage(view())).toContain(`https://r2.jgs.me/${ID}.png`);
  });
});
