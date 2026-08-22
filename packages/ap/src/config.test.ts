import { describe, expect, it } from "vitest";
import { articleURL, objectURI, shareURL } from "./config";

describe("shareURL", () => {
  it("page.id 由来の /p/<n> を返す", () => {
    expect(shareURL(6220)).toBe("https://w.jgs.me/p/6220");
  });

  it("改題の影響を受けない (title を取らない)", () => {
    // /pages/<title> と違い、記事を改題しても URL が変わらない。
    expect(shareURL(1)).toBe(shareURL(1));
  });

  it("objectURI と同じ page.id を指すが別のパスになる", () => {
    // /o/<n> は ActivityPub の id。Accept で AS2 を返し分けるため、
    // 人間向けに撒く URL には使わない。
    expect(shareURL(42)).toBe("https://w.jgs.me/p/42");
    expect(objectURI(42)).toBe("https://w.jgs.me/o/42");
  });
});

describe("articleURL", () => {
  it("title を percent encoding して /pages/<title> を返す", () => {
    expect(articleURL("Bluesky 配信テスト")).toBe(
      "https://w.jgs.me/pages/Bluesky%20%E9%85%8D%E4%BF%A1%E3%83%86%E3%82%B9%E3%83%88",
    );
  });
});
