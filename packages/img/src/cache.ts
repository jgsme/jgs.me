import type { Context, Next } from "hono";

// id は内容の sha256。個別ページのキャッシュはこの形のパスにだけ付ける。
// `/:id` と書くと /health にも当たる。
export const ID_PATH = "/:id{[0-9a-f]{64}}";

// 個別ページのキャッシュ。行は消えうるので immutable にはしない。
// packages/web のように Cache API までは使わない。あちらには HEAD の応答を
// GET の答えとして焼いて 404 が固定された事故のコメントが残っている。
export const cacheMiddleware = async (c: Context, next: Next) => {
  await next();
  // 404 を焼くと、消しただけの id が max-age の間ずっと 404 のままになる。
  if (!c.res.ok) return;
  // c.res.headers.set ではなく c.header を使う。fetch 由来の Response は
  // ヘッダが immutable で、set すると TypeError で 500 になる。
  // c.header は必要なら Response を作り直す。packages/web の cache.ts も同じ。
  c.header("Cache-Control", "public, max-age=300");
};
