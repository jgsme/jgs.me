// 下書きの応答に付ける 3 つのヘッダ。
// - no-store: エッジにも共有キャッシュにも載せない (鍵入りの URL を残さない)
// - noindex: 検索に載せない
// - no-referrer: 外部リンク先に鍵入りの URL を Referer で渡さない
export const DRAFT_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
} as const;

export function applyDraftHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(DRAFT_HEADERS)) {
    headers.set(name, value);
  }
}
