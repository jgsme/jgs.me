// app.bsky.feed.post.text の上限。grapheme cluster 単位で数える。
export const MAX_GRAPHEMES = 300;

// String.length は UTF-16 コードユニット数であり grapheme 数ではない。
// 絵文字はサロゲートペアで 2、国旗は 4、ZWJ 連結はさらに増える。
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function countGraphemes(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

export function truncateGraphemes(
  s: string,
  max: number,
): { text: string; truncated: boolean } {
  const parts: string[] = [];
  for (const seg of segmenter.segment(s)) {
    parts.push(seg.segment);
    if (parts.length > max) {
      // max+1 個目に到達した時点で超過が確定する。
      return { text: parts.slice(0, max).join(""), truncated: true };
    }
  }
  return { text: s, truncated: false };
}
