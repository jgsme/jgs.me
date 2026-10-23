import { zetAtUri, zetDisplayTitle, zetPath } from "@jigsaw/db/zet";

export type ZetListItem = {
  rkey: string;
  // 記事と同じ /pages/zet%3A<rkey>。記事ページがそのまま描く。
  href: string;
  atUri: string;
  // 題、無ければ日付 (spec)。page.title (zet:<rkey>) は出さない。画像の alt 用。
  heading: string;
  // 題があるときだけ。タイムラインは左に日付を出すので、題の無い zet に
  // 日付を見出しとして重ねて出さない。
  title: string | null;
  date: string;
  year: string;
  monthDay: string;
  image: string | null;
  // 本文の抜粋 (記法を落とした先頭 200 字)。画像だけの本文だと空になるので null。
  excerpt: string | null;
  // ネタバレなら抜粋の代わりに印を出す。
  spoiler: boolean;
};

export type ZetTimelineItem = ZetListItem & {
  // 同じ日が続いたら 2 件目からは日付を出さない。
  showDate: boolean;
};

type Row = {
  rkey: string;
  title: string | null;
  date: string;
  image: string | null;
  excerpt: string | null;
  spoiler?: boolean;
};

export function toZetListItem(row: Row): ZetListItem {
  const [year = "", month = "", day = ""] = row.date.split("-");
  const title =
    row.title !== null && row.title.trim() !== "" ? row.title : null;
  return {
    rkey: row.rkey,
    href: zetPath(row.rkey),
    atUri: zetAtUri(row.rkey),
    heading: zetDisplayTitle(row),
    title,
    date: row.date,
    year,
    monthDay: `${month}/${day}`,
    image: row.image,
    excerpt: row.spoiler || row.excerpt === "" ? null : row.excerpt,
    spoiler: row.spoiler ?? false,
  };
}

export function toZetTimeline(rows: readonly Row[]): ZetTimelineItem[] {
  return rows.map((row, i) => ({
    ...toZetListItem(row),
    showDate: i === 0 || rows[i - 1]!.date !== row.date,
  }));
}
