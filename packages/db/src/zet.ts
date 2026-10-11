// zet (diary の日々の断片。本体は PDS ds.jgs.me の me.jgs.diary.zet record) の
// 題と URL の規則。ingest (取り込み) / ap (配送) / web (表示) / og (OG 画像) が
// 同じ規則を使うのでここに置く。

// page.title は /pages/<title> の実キーで UNIQUE。zet は題を持たないことがあり、
// 題が重なることもあるので、page.title には rkey 由来の内部キーを入れる。
// URL には出る (/pages/zet%3A<rkey>) が、人に見せる題は zetDisplayTitle で作る。
export const ZET_TITLE_PREFIX = "zet:";

// copy 表 (object.id → 他プロトコルの複製) の protocol。zet の record の at-uri と
// CID を持つ。"atproto" は bsky 投稿 (packages/ap/src/bsky/post.ts) が
// (objectID, protocol) に upsert しているので、同じ値にすると zet の行が
// bsky 投稿の at-uri で上書きされ、次の update で zet を引けなくなる。
export const ZET_COPY_PROTOCOL = "atproto-zet";

export function zetPageTitle(rkey: string): string {
  return `${ZET_TITLE_PREFIX}${rkey}`;
}

// サイト内のパス。zet も記事と同じ /pages/<page.title> で出す
// (記事ページがそのまま描く)。絶対 URL は各 package の SITE_URL と組む。
export function zetPath(rkey: string): string {
  return `/pages/${encodeURIComponent(zetPageTitle(rkey))}`;
}

// 人に見せる題。題の無い zet は日付を見出しにする (spec)。
export function zetDisplayTitle(z: {
  title: string | null;
  date: string;
}): string {
  return z.title !== null && z.title.trim() !== "" ? z.title : z.date;
}

// page を leftJoin(zet) で引いた行から人に見せる題を決める。
// zet.date は NOT NULL なので、zetDate が null なら zet ではない。
export function pageDisplayTitle(row: {
  title: string;
  zetTitle: string | null;
  zetDate: string | null;
}): string {
  if (row.zetDate === null) return row.title;
  return zetDisplayTitle({ title: row.zetTitle, date: row.zetDate });
}
