import { describe, expect, it } from "vitest";
import { bodyImageSources } from "./bodyImage";

const R2 = "https://r2.jgs.me/deadbeef.png";
const CDN = "https://r2.jgs.me/cdn-cgi/image";

describe("bodyImageSources", () => {
  it("R2 の画像は 840w を src にする", () => {
    expect(bodyImageSources(R2).src).toBe(
      `${CDN}/width=840,format=auto,onerror=redirect/deadbeef.png`,
    );
  });

  // 420 は 1x のスマホ、840 は 2x のスマホと 1x の PC、1536 は 3x と 2x の PC。
  it("R2 の画像は 3 本の候補を w 記述子で並べる", () => {
    expect(bodyImageSources(R2).srcSet).toBe(
      [
        `${CDN}/width=420,format=auto,onerror=redirect/deadbeef.png 420w`,
        `${CDN}/width=840,format=auto,onerror=redirect/deadbeef.png 840w`,
        `${CDN}/width=1536,format=auto,onerror=redirect/deadbeef.png 1536w`,
      ].join(", "),
    );
  });

  // px-4 の左右 2rem を引かないと、ブラウザが必要幅を過大に見積もって
  // 1 段上の候補を引いてしまう。
  it("sizes は本文の実幅を表す", () => {
    expect(bodyImageSources(R2).sizes).toBe(
      "(max-width: 768px) calc(100vw - 2rem), 736px",
    );
  });

  // 変換が効くのは R2 の画像だけ。候補を並べても同じ URL が 3 本並ぶだけになる。
  it("Gyazo の画像は src をそのまま返し srcSet も sizes も付けない", () => {
    const gyazo = "https://gyazo.com/abc123/thumb/1000";
    expect(bodyImageSources(gyazo)).toEqual({ src: gyazo });
  });

  it("外部の画像は src をそのまま返し srcSet も sizes も付けない", () => {
    const other = "https://example.com/a.png";
    expect(bodyImageSources(other)).toEqual({ src: other });
  });

  // ホスト名が前方一致するだけの別ホストを R2 と誤認しない。
  it("r2.jgs.me を名前に含むだけの別ホストは素通しする", () => {
    const evil = "https://r2.jgs.me.evil.example/a.png";
    expect(bodyImageSources(evil)).toEqual({ src: evil });
  });
});
