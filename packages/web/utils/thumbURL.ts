const MEDIA_BASE = "https://r2.jgs.me";

// R2 に置いた画像は Cloudflare の Image Transformations で縮小する。
// 変換元を同じホストの相対パスにしてあるのは、絶対 URL 指定だと
// allowed origins の設定が要るのと、onerror=redirect が
// 「変換元が変換と同じドメインにある場合のみ」しか効かないため。
// 無料枠 (月 5,000 unique) を超えても原寸に落ちるだけで画像は壊れない。
//
// Gyazo の /raw は原寸が返ってくる。移行しない page が残るので分岐は生かす。
//
// square は object-cover の正方形枠に敷く画像向け。width だけ指定すると横長の画像は
// 高さが size に届かず、枠を覆うためにブラウザ側で拡大されてぼやける。
// 切り出しは中央 (object-cover の既定と同じ) なので見た目は変わらない。
export function thumbURL(
  image: string,
  size = 400,
  { square = false }: { square?: boolean } = {},
): string {
  if (image.startsWith(`${MEDIA_BASE}/`)) {
    const key = image.slice(MEDIA_BASE.length + 1);
    const dims = square
      ? `width=${size},height=${size},fit=cover`
      : `width=${size}`;
    return `${MEDIA_BASE}/cdn-cgi/image/${dims},format=auto,onerror=redirect/${key}`;
  }
  if (!image.includes("gyazo.com")) return image;
  return image.replace("/raw", `/thumb/${size}`);
}
