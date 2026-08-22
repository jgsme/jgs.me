import { toISO } from "../as2";
import { summarize } from "../as2";
import type { BlobRef } from "./blob";
import { linkFacets } from "./facets";
import { MAX_GRAPHEMES, htmlToText, truncateGraphemes } from "./text";

export type PostInput = {
  title: string;
  // D1 の page.created。"YYYY-MM-DD HH:MM:SS" で来ることも
  // ISO 8601 で来ることもある (Scrapbox アーカイブと Micropub の違い)。
  created: string;
  html: string;
  url: string;
  thumb: BlobRef | null;
};

// app.bsky.feed.post のレコードを組み立てる。副作用を持たせない。
export function buildPostRecord(input: PostInput): Record<string, unknown> {
  const { title, created, html, url, thumb } = input;

  // 本文を 300 grapheme に収める。切り詰めは grapheme cluster 単位。
  // 上限ちょうどは切らない。超えたときだけ末尾の … の分を1つ空ける。
  const plain = htmlToText(html);
  const capped = truncateGraphemes(plain, MAX_GRAPHEMES);
  const text = capped.truncated
    ? `${truncateGraphemes(plain, MAX_GRAPHEMES - 1).text}…`
    : capped.text;

  const record: Record<string, unknown> = {
    $type: "app.bsky.feed.post",
    text,
    // ATProto の createdAt は datetime 形式を要求する。D1 が返す
    // "YYYY-MM-DD HH:MM:SS" をそのまま渡すと createRecord に弾かれる。
    // ActivityPub 側 (as2.toArticle) と同じ正規化を通す。
    createdAt: toISO(created),
    langs: ["ja"],
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: url,
        title,
        description: summarize(html, 200),
        ...(thumb ? { thumb } : {}),
      },
    },
  };

  // 本文中に記事 URL が現れる場合だけ facet を張る。
  const facets = linkFacets(text, [{ uri: url, label: url }]);
  if (facets.length > 0) record.facets = facets;

  return record;
}
