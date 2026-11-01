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
