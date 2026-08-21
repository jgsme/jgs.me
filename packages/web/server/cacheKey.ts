// HTML を caches.default に入れると、デプロイしてもそのキャッシュは消えない。
// Vike はビルドのたびにアセットのファイル名のハッシュを変えるため、
// 古い HTML が配られ続けると、そこが指すアセットは既に存在せず 500 になる。
// キャッシュキーにデプロイのバージョンを混ぜて、デプロイごとに別キーにする。
// 古いエントリは参照されなくなり TTL で落ちる。
export function cacheKeyFor(url: string, version: string): string {
  const u = new URL(url);
  u.searchParams.set("__v", version);
  return u.toString();
}
