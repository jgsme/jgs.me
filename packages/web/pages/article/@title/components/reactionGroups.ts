import type { ReactionJSON } from "@/server/routes/reactions";

// カードにする kind。「どこから来たか」が本体のものだけ。like に題を出しても
// 情報が増えないので、それらはアイコンの粒のまま並べる。
const CARD_KINDS = new Set(["reply", "mention"]);

export type ReactionGroups = {
  cards: ReactionJSON[];
  glyphs: ReactionJSON[];
};

export function splitReactions(rs: ReactionJSON[]): ReactionGroups {
  const cards: ReactionJSON[] = [];
  const glyphs: ReactionJSON[] = [];
  for (const r of rs) {
    // 知らない kind は粒に寄せる。カードは題か本文が無いと空箱になる。
    (CARD_KINDS.has(r.kind) ? cards : glyphs).push(r);
  }
  return { cards, glyphs };
}

// カードに出す反応元リンク。actor_url へはフォールバックしない。
// ActivityPub の反応は source_url が空で actor_url がプロフィールを指すので、
// 埋めると「反応元ページ」の欄にプロフィール URL が出て嘘になる。
// 題と URL は Webmention 受信時に必ず揃うので、片方だけの行は出さない。
export function cardSource(
  r: ReactionJSON,
): { url: string; title: string } | null {
  if (!r.sourceURL || !r.sourceTitle) return null;
  return { url: r.sourceURL, title: r.sourceTitle };
}
