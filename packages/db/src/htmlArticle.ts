// HTML 記事を表示用に組み直した結果 (R2 の <key>.render.json) の型と、
// 派生テキスト (<key>.sb) の読み出し。

// 入れ物の要素に付ける class。CSS のスコープ化と web 側の判定に使う。
export const HTML_ARTICLE_CLASS = "jgs-html-article";

// 組み直しの版。規則を変えたら上げる。
export const RENDER_VERSION = 1;

export type HeadLink = {
  rel: "stylesheet" | "preconnect";
  href: string;
  crossOrigin?: string;
  media?: string;
  type?: string;
  integrity?: string;
  referrerPolicy?: string;
};

export type HeadStyle = { css: string; media: string | null };

export type RenderedHtmlArticle = {
  version: number;
  head: { links: HeadLink[]; styles: HeadStyle[] };
  // 入れ物の要素ごとの HTML
  // (<div class="jgs-html-article …" lang=… style=…>…</div>)
  body: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isOptionalString = (v: unknown): boolean =>
  v === undefined || typeof v === "string";

function isHeadLink(v: unknown): v is HeadLink {
  return (
    isRecord(v) &&
    (v.rel === "stylesheet" || v.rel === "preconnect") &&
    typeof v.href === "string" &&
    isOptionalString(v.crossOrigin) &&
    isOptionalString(v.media) &&
    isOptionalString(v.type) &&
    isOptionalString(v.integrity) &&
    isOptionalString(v.referrerPolicy)
  );
}

function isHeadStyle(v: unknown): v is HeadStyle {
  return (
    isRecord(v) &&
    typeof v.css === "string" &&
    (v.media === null || typeof v.media === "string")
  );
}

// 形だけ確かめる。version の値は見ない (古い版でも形が合えば読む。
// 版の判断は読み側の仕事)。形が違えば null。
export function parseRenderedHtmlArticle(
  value: unknown,
): RenderedHtmlArticle | null {
  if (!isRecord(value)) return null;
  if (typeof value.version !== "number") return null;
  if (typeof value.body !== "string") return null;
  const head = value.head;
  if (!isRecord(head)) return null;
  if (!Array.isArray(head.links) || !head.links.every(isHeadLink)) return null;
  if (!Array.isArray(head.styles) || !head.styles.every(isHeadStyle)) {
    return null;
  }
  return value as RenderedHtmlArticle;
}

// 派生テキスト (<key>.sb、1行目が題) から本文の行だけ取る。
// 1行目と、空・空白だけの行を落とす。記法らしい文字は触らない。
export function derivedTextLines(sb: string): string[] {
  return sb
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "");
}
