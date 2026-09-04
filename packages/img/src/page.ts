import { MEDIA_BASE_URL, SITE_URL } from "./config";

export interface SharedImageView {
  id: string;
  ext: string;
  sourceURL: string | null;
  sourceTitle: string | null;
  width: number | null;
  height: number | null;
  created: string;
}

// 属性値に入れる用。& を先に置き換えないと二重エスケープになる。
function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// 出典 URL は他所のページから来る。javascript: や data: を href に出すと
// クリックで実行される。http/https 以外はリンクにしない。
export function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// 元画像をそのまま og:image にすると、大きい画像で unfurl 側が諦める
// (X は 5MB 上限)。Image Transformations を噛ませて幅を落とす。
// packages/web/utils/thumbURL.ts と同じ手法。
export function ogImageURL(id: string, ext: string): string {
  return `${MEDIA_BASE_URL}/cdn-cgi/image/width=1200,format=auto/${id}.${ext}`;
}

export function renderPage(v: SharedImageView): string {
  const title = v.sourceTitle ?? "jgs.me";
  const direct = `${MEDIA_BASE_URL}/${v.id}.${v.ext}`;
  const href = safeHref(v.sourceURL);

  const dims = [
    v.width === null
      ? ""
      : `<meta property="og:image:width" content="${v.width}">`,
    v.height === null
      ? ""
      : `<meta property="og:image:height" content="${v.height}">`,
  ]
    .filter(Boolean)
    .join("\n");

  const source =
    href === null
      ? ""
      : `<p class="source">from <a href="${esc(href)}">${esc(title)}</a></p>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:url" content="${SITE_URL}/${v.id}">
<meta property="og:image" content="${ogImageURL(v.id, v.ext)}">
${dims}
<meta name="twitter:card" content="summary_large_image">
<style>
body { margin: 0; background: #111; color: #eee; font: 14px system-ui, sans-serif; }
main { max-width: 1200px; margin: 0 auto; padding: 16px; }
img { max-width: 100%; height: auto; display: block; }
a { color: #8ab4f8; }
.meta { margin-top: 12px; color: #aaa; font-size: 12px; }
.meta code { user-select: all; }
</style>
</head>
<body>
<main>
<img src="${direct}" alt="">
${source}
<p class="meta">${esc(v.created)}<br><code>${direct}</code></p>
</main>
</body>
</html>
`;
}
