// 拡張子は Content-Type から決める。相手が付けたファイル名を信用しない。
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function extForType(contentType: string): string | undefined {
  return EXT_BY_TYPE[contentType];
}

// 内容から鍵を作る。同じ画像を二度上げても 1 つにまとまる。
// put の前にキーだけ知りたい呼び出し元 (img worker の重複判定) があるので、
// putMedia から独立させている。両者が同じキーを出すことは media.test.ts が
// 固定している。
export async function mediaKey(
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) return null;

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}.${ext}`;
}

// 画像を w-media に置いてキーを返す。未対応の Content-Type なら null。
// Micropub の media endpoint (ingest)、Gyazo の取り込み (ingest)、Webmention の
// 画像取り込み (ap)、拡張からの投稿 (img) で共用する。worker をまたぐので
// 独立したパッケージにある。
export async function putMedia(
  bucket: R2Bucket,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const key = await mediaKey(bytes, contentType);
  if (key === null) return null;

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
