// /pages/<title> のパス。web (href・canonical・リダイレクト先) と ingest
// (Location・purge) が同じ形を組むのでここに置く。形がずれるとキャッシュキーが
// 別になり、ingest の purge が web の配っている HTML に当たらない。
// 絶対 URL は各 package の SITE_URL と組む。
//
// encodeURIComponent は ' を残すが、React は属性値の ' を &#x27; にする。
// ブラウザはデコードして読むので困らないが、生の HTML から href を抜く外形監視は
// &#x27; ごと叩き、& 以降がクエリになって別のページを引く。' も % にしておく。
export function pagePath(title: string): string {
  return `/pages/${encodeURIComponent(title).replaceAll("'", "%27")}`;
}
