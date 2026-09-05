import { thumbURL } from "./thumbURL";

type Sources = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

// 変換が効くのは R2 に取り込んだ画像だけ。Gyazo や外部の URL は thumbURL が
// 素通し (Gyazo は /thumb/<size> に差し替えるだけ) なので、候補を並べても
// 同じ URL が並ぶことになる。そういう URL では srcSet も sizes も付けない。
function build(
  image: string,
  widths: readonly number[],
  sizes: string,
): Sources {
  const src = thumbURL(image, widths[0]!);
  if (!image.startsWith("https://r2.jgs.me/")) return { src };

  return {
    src,
    srcSet: widths.map((w) => `${thumbURL(image, w)} ${w}w`).join(", "),
    sizes,
  };
}

// 一覧 (トップ / クリップ) の大きいカード。
// コンテナは max-w-content (768px) から px-4 の左右 2rem を引いた 736px。
// 画像は h-hero (300px) object-contain なので、縦長なら幅は 300px 未満に収まるが、
// 横長だとコンテナ幅いっぱいの 736px まで伸びる。最悪ケースに合わせる。
export function cardImageSources(image: string): Sources {
  return build(
    image,
    [736, 1472],
    "(max-width: 768px) calc(100vw - 2rem), 736px",
  );
}

// 関連記事の正方形タイル。
// 記事の幅 736px を grid-cols-3 gap-3 で割るので 1 タイル 237px。
// sm (640px) 未満は grid-cols-2 になる。
export function tileImageSources(image: string): Sources {
  return build(
    image,
    [240, 480],
    "(max-width: 640px) calc((100vw - 2rem - 0.75rem) / 2), 237px",
  );
}
