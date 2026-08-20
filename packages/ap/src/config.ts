export const SITE_URL = "https://w.jgs.me";

// Cloudflare Workers の fetch は User-Agent を送らない。UA なしの
// リクエストを別ホストへ 301 する設定のサーバが実在し (mstdn.jp)、
// 相手の公開鍵を取得できず Follow を弾いていた。外向きのリクエストには
// 必ずこれを付ける。Fediverse の慣習に合わせてソフト名と連絡先を入れる。
export const USER_AGENT = "jgs-me/0.1.0 (+https://w.jgs.me/)";

// ActivityPub の正準 id。page.id をそのまま使うため、
// /p/<n> と /o/<n> が同じ記事を指す。
export function objectURI(pageID: number): string {
  return `${SITE_URL}/o/${pageID}`;
}

// 人間向けの URL。h-entry の u-url もこれを指す (計画6 Task 1)。
export function articleURL(title: string): string {
  return `${SITE_URL}/pages/${encodeURIComponent(title)}`;
}
