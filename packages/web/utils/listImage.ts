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
  opts: { square?: boolean } = {},
): Sources {
  const src = thumbURL(image, widths[0]!, opts);
  if (!image.startsWith("https://r2.jgs.me/")) return { src };

  return {
    src,
    srcSet: widths.map((w) => `${thumbURL(image, w, opts)} ${w}w`).join(", "),
    sizes,
  };
}

// 一覧 (トップ / クリップ) の大きいカード。
// コンテナは max-w-content (768px) から px-4 の左右 2rem を引いた 736px。
// 画像は h-96 (384px) object-contain なので、縦長なら幅は 384px 未満に収まるが、
// 横長だとコンテナ幅いっぱいの 736px まで伸びる。最悪ケースに合わせる。
export function cardImageSources(image: string): Sources {
  return build(
    image,
    [736, 1472],
    "(max-width: 768px) calc(100vw - 2rem), 736px",
  );
}

// 関連記事と index の clip の正方形タイル。
// 記事の幅 736px を grid-cols-3 gap-3 で割るので 1 タイル 237px。
// sm (640px) 未満は grid-cols-2 になり、1 タイル最大 298px まで広がる。2x で 596px。
// タイルは object-cover なので、width だけで縮めると横長の画像は高さが足りず
// 拡大されてぼやける。正方形に切り出したものを取る。
export function tileImageSources(image: string): Sources {
  return build(
    image,
    [240, 480, 720],
    "(max-width: 640px) calc((100vw - 2rem - 0.75rem) / 2), 237px",
    { square: true },
  );
}

// トップのタイムラインの article。sm (640px) 未満は画面の端まで広げるので 100vw。
// PC の中身の列は w-content (48rem = 768px) が上限で、pl-6 (24px) を引いた 744px。
// 列が上限に届くのは main の px-4 2 つ + 日付の列 6rem + 48rem = 56rem (896px) から。
// それより狭いと列が縮み、100vw から 2rem + 6rem + pl-6 1.5rem = 9.5rem を引いた幅になる。
// h-64 / h-96 の object-contain なので、横長なら列の幅いっぱいまで伸びる最悪ケースに合わせる。
export function timelineArticleImageSources(image: string): Sources {
  return build(
    image,
    [744, 1488],
    "(max-width: 640px) 100vw, (max-width: 896px) calc(100vw - 9.5rem), 744px",
  );
}

// トップのタイムラインの正方形タイル。PC は 744px を grid-cols-3 gap-3 で割って 240px。
// 640〜896px は中身の列 (100vw - 9.5rem) から gap-3 2 つ (1.5rem) を引いて 3 列。
// sm 未満は main の px-4 2 つ + 日付の列 w-12 (3rem) + pl-4 = 6rem を引いて 2 列
// (gap-2 は小さく、大きめに見積もる側なので sizes に入れない)。切り出しは tileImageSources と同じ。
export function timelineTileImageSources(image: string): Sources {
  return build(
    image,
    [240, 480, 720],
    "(max-width: 640px) calc((100vw - 6rem) / 2), (max-width: 896px) calc((100vw - 11rem) / 3), 240px",
    { square: true },
  );
}
