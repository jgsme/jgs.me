// 記事本文は R2 に置く。page はそのキーだけを持つ (spec §6)。
// Scrapbox アーカイブ由来は Scrapbox ID をそのままキーにし、
// Micropub から入ったものは sb- を前置した UUID を使う。
export const SB_PREFIX = "sb-";

export type BodyFormat = "scrapbox-archive" | "micropub-sb";

export function newSbBodyKey(): string {
  return `${SB_PREFIX}${crypto.randomUUID()}`;
}

export function bodyFormatOf(bodyKey: string): BodyFormat {
  return bodyKey.startsWith(SB_PREFIX) ? "micropub-sb" : "scrapbox-archive";
}

// R2 の実キー。中身の形式が違うので拡張子で分ける。
//   Scrapbox アーカイブ : <key>.json → { lines: [{ text }] }
//   Micropub           : <key>.sb   → Scrapbox 記法の生テキスト (1行目が題)
// どちらも1行目が題という構造で揃えてあるので、読み側は parse() を
// 既定 (hasTitle: true) のまま呼べる。
// 空文字は「本文が存在しない」を意味する。
export function r2KeyOf(bodyKey: string): string | null {
  if (!bodyKey) return null;
  return bodyFormatOf(bodyKey) === "micropub-sb"
    ? `${bodyKey}.sb`
    : `${bodyKey}.json`;
}
