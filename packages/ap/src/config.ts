export const SITE_URL = "https://w.jgs.me";

// ActivityPub の正準 id。page.id をそのまま使うため、
// /p/<n> と /o/<n> が同じ記事を指す。
export function objectURI(pageID: number): string {
  return `${SITE_URL}/o/${pageID}`;
}

// 人間向けの URL。h-entry の u-url もこれを指す (計画6 Task 1)。
export function articleURL(title: string): string {
  return `${SITE_URL}/pages/${encodeURIComponent(title)}`;
}
