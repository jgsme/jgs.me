export interface Env {
  // 本体 D1 (w)。shared_image だけを触る。
  DB: D1Database;
  // 画像バケット w-media。
  MEDIA: R2Bucket;
  // 拡張からの投稿を通す Bearer トークン。wrangler secret put IMG_TOKEN。
  IMG_TOKEN: string;
}
