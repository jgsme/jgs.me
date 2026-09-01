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
