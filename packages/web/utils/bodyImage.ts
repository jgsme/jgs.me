import { thumbURL } from "./thumbURL";

// 本文の横幅。max-w-3xl (768px) から px-4 の左右 2rem を引いた値。
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

// 記事本文の画像を出すための src / srcSet / sizes を組む。
// 変換が効くのは R2 に取り込んだ画像だけ。Gyazo や外部の URL は thumbURL が
// 素通しするので、候補を並べても同じ URL が 3 本並ぶだけになる。
// そういう URL では srcSet も sizes も付けない。
export function bodyImageSources(image: string): BodyImage {
  const src = thumbURL(image, DEFAULT_WIDTH);
  if (src === image) return { src };

  return {
    src,
    srcSet: WIDTHS.map((w) => `${thumbURL(image, w)} ${w}w`).join(", "),
    // px-4 のぶんを引かないと、ブラウザが必要幅を過大に見積もって
    // 1 段上の候補を引いてしまう。
    sizes: `(max-width: 768px) calc(100vw - 2rem), ${BODY_WIDTH}px`,
  };
}
