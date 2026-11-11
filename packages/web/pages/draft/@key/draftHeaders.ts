import type { MiddlewareHandler } from "hono";

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

// 下書きの 404 / 500 にも同じヘッダを付ける。+data の abort 後は vike が別の
// pageContext でエラーページを描き、+data で積んだ headersResponse が落ちるため、
// 応答の出口でも付ける。キャッシュ (createCacheMiddleware) は通さない。
// 応答の headers は変更不可のことがあるので、作り直してから積む。
export const draftHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.res = new Response(c.res.body, c.res);
  applyDraftHeaders(c.res.headers);
};
