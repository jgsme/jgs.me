import { describe, expect, it } from "vitest";
import { cardImageSources, tileImageSources } from "./listImage";

const R2 = "https://r2.jgs.me/deadbeef.png";
const CDN = "https://r2.jgs.me/cdn-cgi/image";
const at = (w: number) =>
  `${CDN}/width=${w},format=auto,onerror=redirect/deadbeef.png`;

describe("cardImageSources", () => {
  it("R2 の画像は 736w を src にする", () => {
    expect(cardImageSources(R2).src).toBe(at(736));
  });

  // 横長の画像は h-hero (300px) に合わせると幅がコンテナ上限の 736px まで伸びる。
  // 736 が 1x、1472 が 2x を賄う。
  it("R2 の画像は 736w / 1472w を並べる", () => {
    expect(cardImageSources(R2).srcSet).toBe(
      `${at(736)} 736w, ${at(1472)} 1472w`,
    );
  });

  it("sizes はコンテナの実幅を表す", () => {
    expect(cardImageSources(R2).sizes).toBe(
      "(max-width: 768px) calc(100vw - 2rem), 736px",
    );
  });

  it("Gyazo の画像は src だけ返す", () => {
    const gyazo = "https://gyazo.com/abc123/raw";
    expect(cardImageSources(gyazo)).toEqual({
      src: "https://gyazo.com/abc123/thumb/736",
    });
  });

  it("外部の画像はそのまま返す", () => {
    const other = "https://example.com/a.png";
    expect(cardImageSources(other)).toEqual({ src: other });
  });
});

describe("tileImageSources", () => {
  // aspect-square の 3 列グリッド。1 タイルは記事幅 736px を 3 分割した 237px。
  it("R2 の画像は 240w を src にする", () => {
    expect(tileImageSources(R2).src).toBe(at(240));
  });

  it("R2 の画像は 240w / 480w を並べる", () => {
    expect(tileImageSources(R2).srcSet).toBe(
      `${at(240)} 240w, ${at(480)} 480w`,
    );
  });

  // sm 未満は 2 列、それ以上は 3 列。gap を引いた実幅を渡す。
  it("sizes は 2 列 / 3 列の実幅を表す", () => {
    expect(tileImageSources(R2).sizes).toBe(
      "(max-width: 640px) calc((100vw - 2rem - 0.75rem) / 2), 237px",
    );
  });

  it("Gyazo の画像は src だけ返す", () => {
    const gyazo = "https://gyazo.com/abc123/raw";
    expect(tileImageSources(gyazo)).toEqual({
      src: "https://gyazo.com/abc123/thumb/240",
    });
  });

  // ホスト名が前方一致するだけの別ホストを R2 と誤認しない。
  it("r2.jgs.me を名前に含むだけの別ホストは素通しする", () => {
    const evil = "https://r2.jgs.me.evil.example/a.png";
    expect(tileImageSources(evil)).toEqual({ src: evil });
  });
});
