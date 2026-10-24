import { htmlToText } from "../text";
import { truncateGraphemes } from "../bsky/text";
import { spoilerText } from "../spoiler";

// Threads の text は 500 文字。ただし絵文字だけ UTF-8 バイト数で数えられる
// 仕様なので、grapheme 500 に収めても稀に 400 で弾かれうる。まずこれで
// 運用し、実際に落ちたら下げる。
export const MAX_THREADS_GRAPHEMES = 500;

export type ThreadsPostInput = {
  html: string;
  // SNS に貼るのは /p/<n>。/pages/<title> は改題で壊れる。
  url: string;
  // ネタバレなら本文の代わりに題と URL だけを出す。
  spoiler?: { title: string };
  // Grain に出した画像だけの zet。あれば本文の代わりにこの URL だけを出す
  // (link_attachment も同じ URL で、Threads 側がカードを作る)。
  grainUrl?: string | null;
};

export type ContainerParams = {
  text: string;
  linkAttachment: string;
};

// container 作成に渡すパラメータを組み立てる。副作用を持たせない。
// 上限ちょうどは切らない。超えたときだけ末尾の … の分を1つ空ける。
export function buildContainerParams(input: ThreadsPostInput): ContainerParams {
  if (input.grainUrl) {
    return { text: input.grainUrl, linkAttachment: input.grainUrl };
  }
  if (input.spoiler) {
    const title = truncateGraphemes(input.spoiler.title, 200);
    return {
      text: spoilerText(
        title.truncated
          ? `${truncateGraphemes(input.spoiler.title, 199).text}…`
          : title.text,
        input.url,
      ),
      linkAttachment: input.url,
    };
  }
  const plain = htmlToText(input.html);
  const capped = truncateGraphemes(plain, MAX_THREADS_GRAPHEMES);
  const text = capped.truncated
    ? `${truncateGraphemes(plain, MAX_THREADS_GRAPHEMES - 1).text}…`
    : capped.text;

  return { text, linkAttachment: input.url };
}
