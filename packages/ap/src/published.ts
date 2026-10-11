// 配送・反応の受け付け・object の提供の対象になる page の種類。
// page に article / clip / zet のどれかの行があれば公開済み。
// article と clip の両方を持つ page は article として扱う (先に立った方を
// 尊重する。publish.ts の既存の規則)。zet は他の行と同居しない。
//
// 呼び出し側は page を leftJoin(articles / clips / zets) で引き、
// articleID / clipID / zetRkey を渡す。leftJoin だけだと page 単体の行も
// 1 件返るので、null の判定はここに寄せる。
export type PublishedKind = "article" | "clip" | "zet";

export function publishedKind(row: {
  articleID: number | null;
  clipID: number | null;
  zetRkey: string | null;
}): PublishedKind | null {
  if (row.articleID !== null) return "article";
  if (row.clipID !== null) return "clip";
  if (row.zetRkey !== null) return "zet";
  return null;
}
