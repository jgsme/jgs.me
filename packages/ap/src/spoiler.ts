// diary でネタバレの印を付けた page は、どの配信先にも本文を出さない。
// 題と URL だけを出し、読みたい人はページで「表示する」を押す。

export const SPOILER_LABEL = "ネタバレ";
export const SPOILER_NOTICE = "ネタバレ注意";

export function spoilerText(title: string, url: string): string {
  return `${SPOILER_NOTICE}: ${title} ${url}`;
}

// url は shareURL (/p/<page.id>) なのでエスケープの要る文字を含まない。
export function spoilerHtml(url: string): string {
  return `<p>${SPOILER_NOTICE}: <a href="${url}">${url}</a></p>`;
}
