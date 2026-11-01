import { derivedTextLines } from "@jigsaw/db/html-article";

// HTML 記事の派生テキスト (<key>.sb) は Scrapbox 記法ではない。[..] や # は
// 原文の字そのままなので、purifyScrapboxText などに通さない。

const DESCRIPTION_LENGTH = 200;

// 1 行目 (題) と空行を落とした本文の行。
export const htmlArticleText = (sbBody: string): string[] =>
  derivedTextLines(sbBody);

// og:description / RSS の抜粋。行を空白 1 つで繋ぎ、連続空白を 1 つにする。
export const htmlArticleDescription = (sbBody: string): string =>
  htmlArticleText(sbBody)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DESCRIPTION_LENGTH);

export const isHtmlArticleData = (data: unknown): boolean =>
  typeof data === "object" &&
  data !== null &&
  (data as { ok?: unknown }).ok === true &&
  (data as { view?: unknown }).view === "html";

// HTML 記事の本文は自分で書いた HTML をそのまま描く。そこから出る通信を
// 絞るための CSP。script は CDN と GA だけ、frame / form / base は塞ぐ。
// connect-src の google-analytics / analytics.google.com / googletagmanager は
// +Head.tsx の GA (gtag) が送信に使う分。
export const HTML_ARTICLE_CSP = [
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export const htmlArticleHeaders = (data: unknown): Record<string, string> =>
  isHtmlArticleData(data)
    ? { "Content-Security-Policy": HTML_ARTICLE_CSP }
    : {};

// vike の headersResponse (評価済みの Headers) に CSP を足す。
export const applyHtmlArticleCsp = (headers: Headers, data: unknown): void => {
  for (const [k, v] of Object.entries(htmlArticleHeaders(data))) {
    headers.set(k, v);
  }
};
