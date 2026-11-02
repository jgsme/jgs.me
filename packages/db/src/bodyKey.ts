// 記事本文は R2 に置く。page はそのキーだけを持つ (spec §6)。
// Scrapbox アーカイブ由来は Scrapbox ID をそのままキーにし、
// Micropub から入ったものは sb- を前置した UUID を使う。
// standard.site の document (HTML 記事) は html- を前置した UUID を使う。
export const SB_PREFIX = "sb-";
export const HTML_PREFIX = "html-";

export type BodyFormat = "scrapbox-archive" | "micropub-sb" | "standard-html";

export function newSbBodyKey(): string {
  return `${SB_PREFIX}${crypto.randomUUID()}`;
}

export function newHtmlBodyKey(): string {
  return `${HTML_PREFIX}${crypto.randomUUID()}`;
}

export function bodyFormatOf(bodyKey: string): BodyFormat {
  if (bodyKey.startsWith(HTML_PREFIX)) return "standard-html";
  return bodyKey.startsWith(SB_PREFIX) ? "micropub-sb" : "scrapbox-archive";
}

// .sb を生テキスト (Scrapbox 記法、1行目が題) で持つ形式か。
// standard-html の .sb は HTML から作った派生テキストで、検索・日付解決・
// 抜粋のために置く。
export function isTextBody(bodyKey: string): boolean {
  const format = bodyFormatOf(bodyKey);
  return format === "micropub-sb" || format === "standard-html";
}

// R2 の実キー。中身の形式が違うので拡張子で分ける。
//   Scrapbox アーカイブ : <key>.json → { lines: [{ text }] }
//   Micropub           : <key>.sb   → Scrapbox 記法の生テキスト (1行目が題)
//   standard-html      : <key>.sb   → HTML から作った派生テキスト (1行目が題)
//                        <key>.html → 原本の HTML (htmlKeyOf)
//                        <key>.render.json → 組み直し済みの表示用 (renderKeyOf)
// どちらも1行目が題という構造で揃えてあるので、読み側は parse() を
// 既定 (hasTitle: true) のまま呼べる。
// 空文字は「本文が存在しない」を意味する。
export function r2KeyOf(bodyKey: string): string | null {
  if (!bodyKey) return null;
  return isTextBody(bodyKey) ? `${bodyKey}.sb` : `${bodyKey}.json`;
}

// standard-html だけが持つ原本 HTML と組み直し済みの表示用。他は null。
export function htmlKeyOf(bodyKey: string): string | null {
  if (!bodyKey || bodyFormatOf(bodyKey) !== "standard-html") return null;
  return `${bodyKey}.html`;
}

export function renderKeyOf(bodyKey: string): string | null {
  if (!bodyKey || bodyFormatOf(bodyKey) !== "standard-html") return null;
  return `${bodyKey}.render.json`;
}

// 検索インデックス用の派生物のキー (バケット w-md)。原本と違って由来で
// 分ける必要が無い。中身は toMarkdown() の出力で、どちらの由来も同じ形。
// AutoRAG は拡張子と MIME の両方で対応形式を判定するので、拡張子は対応表に
// ある .md でなければならない (.sb は unsupported_type で弾かれる)。
export function mdKeyOf(bodyKey: string): string | null {
  if (!bodyKey) return null;
  return `${bodyKey}.md`;
}
