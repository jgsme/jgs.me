import { MEDIA_BASE_URL } from "./config";

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
// packages/web/utils/thumbURL.ts と同じ手法。onerror=redirect が無いと
// 無料枠 (月 5,000 unique) を超えたときに変換自体が失敗して og:image が
// 壊れる。付けておけば原寸へフォールバックするので unfurl は生き残る。
export function ogImageURL(id: string, ext: string): string {
  return `${MEDIA_BASE_URL}/cdn-cgi/image/width=1200,format=auto,onerror=redirect/${id}.${ext}`;
}

export type SourceLink = { href: string; label: string };

// 出典リンク。ページの題 (sourceTitle ?? "jgs.me") はラベルに使えない。
// sourceTitle が無いのに "jgs.me" と出すと、リンク先は example.com なのに
// ラベルだけ自サイトを名乗る嘘の表示になる。ホスト名なら嘘にならない。
export function sourceLink(
  sourceURL: string | null,
  sourceTitle: string | null,
): SourceLink | null {
  const href = safeHref(sourceURL);
  if (href === null) return null;
  // href は safeHref を通っているので http/https のみ。new URL() は必ず成功する。
  return { href, label: sourceTitle ?? new URL(href).host };
}
