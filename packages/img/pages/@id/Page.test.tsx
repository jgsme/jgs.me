import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImageData } from "./+data";
import { ogVideoFrameURL } from "../../src/page";

const ID = "a".repeat(64);

function data(over: Partial<ImageData> = {}): ImageData {
  return {
    id: ID,
    ext: "png",
    direct: `https://r2.jgs.me/${ID}.png`,
    width: 1200,
    height: 800,
    created: "2026-09-04 12:00:00",
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

  // 出典の表示をやめた結果、他所由来の文字列がページに出なくなった。
  it("外部へのリンクを一つも出さない", () => {
    const html = render(data(), () => <Page />);
    expect(html).not.toContain("<a ");
  });
});

const video = (over: Partial<ImageData> = {}) =>
  data({
    ext: "mp4",
    direct: `https://r2.jgs.me/${ID}.mp4`,
    width: 1280,
    height: 720,
    ...over,
  });

describe("+Page (mp4)", () => {
  it("<video> で出す", () => {
    const html = render(video(), () => <Page />);
    expect(html).toContain("<video");
    expect(html).toContain(`src="https://r2.jgs.me/${ID}.mp4"`);
    expect(html).toContain("controls");
    // この React は playsInline="" と出す。HTML 属性は大文字小文字を区別しない。
    expect(html.toLowerCase()).toContain("playsinline");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('width="1280"');
    expect(html).toContain('height="720"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain("loop");
  });

  it("寸法が無ければ width/height 属性を出さない", () => {
    const html = render(video({ width: null, height: null }), () => <Page />);
    expect(html).not.toContain("width=");
    expect(html).not.toContain("height=");
  });
});

describe("+Head (mp4)", () => {
  it("og:video 系と、フレーム経由の og:image を出す", () => {
    const html = render(video(), () => <Head />);
    const url = `https://r2.jgs.me/${ID}.mp4`;
    expect(html).toContain('content="video.other"');
    expect(html).toContain(`property="og:video" content="${url}"`);
    expect(html).toContain(`property="og:video:secure_url" content="${url}"`);
    expect(html).toContain('property="og:video:type" content="video/mp4"');
    expect(html).toContain('property="og:video:width" content="1280"');
    expect(html).toContain('property="og:video:height" content="720"');
    expect(html).toContain(
      `property="og:image" content="${ogVideoFrameURL(ID, "mp4")}"`,
    );
    expect(html).not.toContain("og:image:width");
    expect(html).toContain('content="summary_large_image"');
  });

  it("寸法が無ければ og:video:width / height を出さない", () => {
    const html = render(video({ width: null, height: null }), () => <Head />);
    expect(html).not.toContain("og:video:width");
    expect(html).not.toContain("og:video:height");
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
