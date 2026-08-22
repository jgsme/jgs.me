// Gyazo の /raw は原寸が返ってくる。一覧やカードで並べる用途には重すぎるので
// サムネイル版に差し替える。Gyazo 以外の URL はそのまま。
export function thumbURL(image: string, size = 400): string {
  if (!image.includes("gyazo.com")) return image;
  return image.replace("/raw", `/thumb/${size}`);
}
