// 拡張子は Content-Type から決める。クライアントのファイル名を信用しない。
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

// 画像を w-media に置いてキーを返す。未対応の Content-Type なら null。
// Micropub の media endpoint と Gyazo の取り込みで共用する。
export async function putMedia(
  bucket: R2Bucket,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) return null;

  // 内容から鍵を作る。同じ画像を二度上げても1つにまとまる。
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `${hex}.${ext}`;

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      // キーが内容の sha256 なので中身は永久に変わらない。
      // R2 のカスタムドメインは既定で cache-control を返さず、
      // Image Transformations 側の既定 (4h) に落ちてしまう。
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return key;
}
