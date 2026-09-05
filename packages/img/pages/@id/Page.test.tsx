import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImageData } from "./+data";

const ID = "a".repeat(64);

function data(over: Partial<ImageData> = {}): ImageData {
  return {
    id: ID,
    ext: "png",
    direct: `https://r2.jgs.me/${ID}.png`,
    width: 1200,
    height: 800,
    created: "2026-09-04 12:00:00",
    source: { href: "https://example.com/article", label: "元記事" },
    ...over,
  };
}

let current: ImageData = data();
vi.mock("vike-react/useData", () => ({ useData: () => current }));

const { default: Page } = await import("./+Page");
const { Head } = await import("./+Head");

function render(d: ImageData, node: () => React.ReactElement) {
  current = d;
  return renderToStaticMarkup(node());
}

describe("+Page", () => {
  it("画像の直リンクと寸法を出す", () => {
    const html = render(data(), () => <Page />);
    expect(html).toContain(`src="https://r2.jgs.me/${ID}.png"`);
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="800"');
  });

  it("寸法が無ければ width/height 属性を出さない", () => {
    const html = render(data({ width: null, height: null }), () => <Page />);
    expect(html).not.toContain("width=");
    expect(html).not.toContain("height=");
  });

  it("出典をリンクにする", () => {
    const html = render(data(), () => <Page />);
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain("元記事");
  });

  it("出典が無ければリンクを出さない", () => {
    const html = render(data({ source: null }), () => <Page />);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("from ");
  });

  // 他所のページの題がそのまま入る。テンプレートリテラルで組んでいた頃は
  // 手書きの esc() が要ったが、JSX にしたのはここを React に任せるため。
  it("題の山括弧をエスケープする", () => {
    const html = render(
      data({ source: { href: "https://example.com/x", label: "<script>x" } }),
      () => <Page />,
    );
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;x");
  });
});

describe("+Head", () => {
  it("og:image は Image Transformations 経由", () => {
    const html = render(data(), () => <Head />);
    expect(html).toContain(
      `content="https://r2.jgs.me/cdn-cgi/image/width=1200,format=auto,onerror=redirect/${ID}.png"`,
    );
    expect(html).toContain('content="summary_large_image"');
    expect(html).toContain(`content="https://i.jgs.me/${ID}"`);
  });

  it("寸法があれば og:image:width / height を出す", () => {
    const html = render(data(), () => <Head />);
    expect(html).toContain('property="og:image:width"');
    expect(html).toContain('property="og:image:height"');
  });

  it("寸法が無ければ og:image:width / height を出さない", () => {
    const html = render(data({ width: null, height: null }), () => <Head />);
    expect(html).not.toContain("og:image:width");
    expect(html).not.toContain("og:image:height");
  });
});
