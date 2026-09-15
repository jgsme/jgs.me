import { thumbURL } from "./thumbURL";

// 本文の横幅。max-w-content (768px) から px-4 の左右 2rem を引いた値。
const BODY_WIDTH = 736;

// 候補の幅。420 は 1x のスマホ、840 は 2x のスマホと 1x の PC、
// 1536 は 3x のスマホと 2x の PC が引く。
// 768 ではなく 840 なのは、768 だと 2x のスマホ (必要 716〜800px) が
// 足りずに 1536 まで飛んでしまうため。
const WIDTHS = [420, 840, 1536] as const;

// src に据える幅。srcset を読まないブラウザと、
// 一番多い 1x の PC の両方に妥当な大きさ。
const DEFAULT_WIDTH = 840;

type BodyImage = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

// 引用の clip で本文画像を絞る幅。ScrapboxNode の max-w-96 (24rem) と同じ値。
// 片方だけ変えると、見た目と sizes がずれて 1 段上の候補を落とす。
export const QUOTE_CLIP_IMAGE_WIDTH = 384;

// 記事本文の画像を出すための src / srcSet / sizes を組む。
// 変換が効くのは R2 に取り込んだ画像だけ。Gyazo や外部の URL は thumbURL が
// 素通しするので、候補を並べても同じ URL が 3 本並ぶだけになる。
// そういう URL では srcSet も sizes も付けない。
//
// width は画像の表示上限 (px)。候補は変えない — 384px でも 2x の画面は 768px を
// 引くので、420 / 840 の刻みがそのまま使える。
export function bodyImageSources(
  image: string,
  { width = BODY_WIDTH }: { width?: number } = {},
): BodyImage {
  return imageSources(
    image,
    WIDTHS,
    // px-4 のぶんを引かないと、ブラウザが必要幅を過大に見積もって
    // 1 段上の候補を引いてしまう。画面幅から 2rem 引いた値が width に届くまでは
    // 画面幅に比例し、届いたら width で止まる。本文幅 736px なら境目は 768px。
    `(max-width: ${width + 32}px) calc(100vw - 2rem), ${width}px`,
  );
}

// 写真の clip で本文の外まで広げる画像の候補。1920px の画面の 90vw は 1x でも
// 1728px 要り、1536 では足りない。2560 は 1x の 2560px 画面 (90vw = 2304px) まで賄う。
// 元画像がこれより小さくても Image Transformations は拡大せず原寸で返すので、
// 小さい画像で無駄に重くはならない。
const PHOTO_WIDTHS = [...WIDTHS, 2560] as const;

// 写真の clip の画像。表示幅は index.css の photo-bleed と揃える:
// max(--container-photo (90vw), 本文幅)。本文幅は 768px までは画面幅 - 2rem、
// その先は 736px。90vw が 736px を越えるのは画面幅 818px から。
export function photoImageSources(image: string): BodyImage {
  return imageSources(
    image,
    PHOTO_WIDTHS,
    `(max-width: ${BODY_WIDTH + 32}px) calc(100vw - 2rem), (max-width: 818px) ${BODY_WIDTH}px, 90vw`,
  );
}

function imageSources(
  image: string,
  widths: readonly number[],
  sizes: string,
): BodyImage {
  const src = thumbURL(image, DEFAULT_WIDTH);
  if (src === image) return { src };

  return {
    src,
    srcSet: widths.map((w) => `${thumbURL(image, w)} ${w}w`).join(", "),
    sizes,
  };
}
