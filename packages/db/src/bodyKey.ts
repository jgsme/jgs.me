// 記事本文は R2 に置く。page はそのキーだけを持つ (spec §6)。
// Scrapbox 由来は Scrapbox ID をそのままキーにし、
// diary から Micropub で入ったものは mp- を前置した UUID を使う。
export const MICROPUB_PREFIX = "mp-";

export function newMicropubBodyKey(): string {
  return `${MICROPUB_PREFIX}${crypto.randomUUID()}`;
}

export function isMicropubBodyKey(key: string): boolean {
  return key.startsWith(MICROPUB_PREFIX);
}

// R2 の実キー。中身の形式が違うので拡張子で分ける。
//   Scrapbox : <key>.json  → { lines: [{ text }] }
//   Micropub : <key>.html  → HTML そのまま
// 空文字は「本文が存在しない」を意味する。
export function r2KeyOf(bodyKey: string): string | null {
  if (!bodyKey) return null;
  return isMicropubBodyKey(bodyKey) ? `${bodyKey}.html` : `${bodyKey}.json`;
}
