// Scrapbox アーカイブ由来の clip。R2 に <scrapboxID>.json があり、object 行
// (mf2) を持たない。diary に取り込んで編集するために、Micropub の source /
// update が扱える mf2 properties をここで組む。
export type ArchiveClip = {
  title: string;
  // page.created。clip.created は登録し直した時刻を含むので使わない
  // (2016 年の clip で clip.created が 2026-08-15 になっている)。
  created: string;
  kind: string;
  // fetchBody の出力。1行目が題。
  text: string;
};

const SQLITE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?$/;

// page.created は "2019-10-01 09:35:02" / "2022-09-29 09:02:14.694206" の
// ような TZ 無しの SQLite 形式 (UTC) と、Micropub 由来の ISO 8601 が混在する。
export function sqliteTimestampToISO(s: string): string {
  const m = SQLITE_TIMESTAMP.exec(s);
  // Date はミリ秒より細かい桁を読めない実装があるので 3 桁に切る。
  const iso = m ? `${m[1]}T${m[2]}${m[3] ? m[3].slice(0, 4) : ""}Z` : s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`unreadable timestamp: ${s}`);
  }
  return d.toISOString();
}

export function archiveClipProperties(
  clip: ArchiveClip,
): Record<string, unknown[]> {
  const newline = clip.text.indexOf("\n");
  const content = newline === -1 ? "" : clip.text.slice(newline + 1);
  // photo は入れない。page.image は Scrapbox が本文から自動で拾った先頭画像
  // (投稿者が明示したサムネではない)。photo に入れると pageImage が photo を
  // 優先するようになり、diary で本文から画像を消しても旧サムネが固定されて
  // 残ってしまう。サムネは Scrapbox のときと同じく pageImage が本文から
  // 都度拾い直す。
  return {
    name: [clip.title],
    content: [content],
    category: ["clip", clip.kind],
    published: [sqliteTimestampToISO(clip.created)],
  };
}
