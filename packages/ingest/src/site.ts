// 公開ホスト。Location / object.id / purge の対象はこれで組む。
// jgs.me (packages/home) ではなく w.jgs.me (packages/web) が記事も zet も出す。
export const SITE_URL = "https://w.jgs.me";

// ActivityPub の正準 id。packages/ap/src/config.ts の objectURI と同じ形。
export function objectURI(pageID: number): string {
  return `${SITE_URL}/o/${pageID}`;
}
