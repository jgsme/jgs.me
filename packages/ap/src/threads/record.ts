import { htmlToText } from "../text";
import { truncateGraphemes } from "../bsky/text";

// Threads の text は 500 文字。ただし絵文字だけ UTF-8 バイト数で数えられる
// 仕様なので、grapheme 500 に収めても稀に 400 で弾かれうる。まずこれで
// 運用し、実際に落ちたら下げる。
export const MAX_THREADS_GRAPHEMES = 500;

export type ThreadsPostInput = {
  html: string;
  // SNS に貼るのは /p/<n>。/pages/<title> は改題で壊れる。
  url: string;
};

export type ContainerParams = {
  text: string;
  linkAttachment: string;
};

// container 作成に渡すパラメータを組み立てる。副作用を持たせない。
// 上限ちょうどは切らない。超えたときだけ末尾の … の分を1つ空ける。
export function buildContainerParams(input: ThreadsPostInput): ContainerParams {
  const plain = htmlToText(input.html);
  const capped = truncateGraphemes(plain, MAX_THREADS_GRAPHEMES);
  const text = capped.truncated
    ? `${truncateGraphemes(plain, MAX_THREADS_GRAPHEMES - 1).text}…`
    : capped.text;

  return { text, linkAttachment: input.url };
}

// 画像だけの zet は本文が空なので、Grain の gallery を代わりに流す。
// TEXT 投稿は text 必須なので URL を本文にも入れる。題があれば前に置く。
export function buildGrainContainerParams(input: {
  title: string | null;
  grainURL: string;
}): ContainerParams {
  const title = input.title?.trim();
  const text = title ? `${title}\n${input.grainURL}` : input.grainURL;
  return { text, linkAttachment: input.grainURL };
}
