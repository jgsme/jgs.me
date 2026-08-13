// Vike の routeParams はデコード済みで渡ってくるため、そのまま使う。
// ここで decodeURIComponent すると "%キ" のような % を含むタイトルが URIError になる。
export function routeTitleToPageTitle(raw: string): string {
  return raw;
}
