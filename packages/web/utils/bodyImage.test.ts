import { describe, expect, it } from "vitest";
import { bodyImageSources, photoImageSources } from "./bodyImage";

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

  // 引用の clip では画像を 384px (max-w-96) に絞って出す。sizes が本文幅のままだと、
  // 見た目は小さいのにブラウザは 736px 前提で 1 段上の候補を落とす。
  it("幅を渡すと sizes はその幅を表す", () => {
    expect(bodyImageSources(R2, { width: 384 }).sizes).toBe(
      "(max-width: 416px) calc(100vw - 2rem), 384px",
    );
  });

  it("幅を渡しても候補と src は変えない", () => {
    const narrow = bodyImageSources(R2, { width: 384 });
    const wide = bodyImageSources(R2);
    expect(narrow.src).toBe(wide.src);
    expect(narrow.srcSet).toBe(wide.srcSet);
  });

  it("幅を渡しても Gyazo や外部の画像は素通しする", () => {
    const other = "https://example.com/a.png";
    expect(bodyImageSources(other, { width: 384 })).toEqual({ src: other });
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

describe("photoImageSources", () => {
  it("src は本文の画像と同じ 840w にする", () => {
    expect(photoImageSources(R2).src).toBe(bodyImageSources(R2).src);
  });

  // 90vw は 1920px の 1x で 1728px 要り、1536 では足りない。
  it("本文の候補に 2560w を足す", () => {
    expect(photoImageSources(R2).srcSet).toBe(
      [
        `${CDN}/width=420,format=auto,onerror=redirect/deadbeef.png 420w`,
        `${CDN}/width=840,format=auto,onerror=redirect/deadbeef.png 840w`,
        `${CDN}/width=1536,format=auto,onerror=redirect/deadbeef.png 1536w`,
        `${CDN}/width=2560,format=auto,onerror=redirect/deadbeef.png 2560w`,
      ].join(", "),
    );
  });

  // 表示幅は max(90vw, 本文幅)。768px までは本文幅が画面に比例し、
  // 818px (90vw が 736px を越える境目) までは本文幅 736px、その先は 90vw。
  it("sizes は本文幅と 90vw の広いほうを表す", () => {
    expect(photoImageSources(R2).sizes).toBe(
      "(max-width: 768px) calc(100vw - 2rem), (max-width: 818px) 736px, 90vw",
    );
  });

  it("Gyazo や外部の画像は素通しする", () => {
    const other = "https://example.com/a.png";
    expect(photoImageSources(other)).toEqual({ src: other });
  });
});
