// Vike の routeParams は %2F だけデコードせずに残す (パスの区切りと衝突するため)。
// それ以外の %XX はデコード済みなので、全体を decodeURIComponent すると
// "%キ" のような % を含むタイトルが URIError になり、%25 も二重デコードされる。
// ここでは Vike が残した %2F だけをスラッシュに戻す。
export function routeTitleToPageTitle(raw: string): string {
  return raw.replace(/%2F/gi, "/");
}
