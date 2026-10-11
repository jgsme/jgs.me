import { zetDisplayTitle, zetPath } from "@jigsaw/db/zet";

export type ZetListItem = {
  rkey: string;
  // 記事と同じ /pages/zet%3A<rkey>。記事ページがそのまま描く。
  href: string;
  // 題、無ければ日付 (spec)。page.title (zet:<rkey>) は出さない。
  heading: string;
  date: string;
  image: string | null;
};

export function toZetListItem(row: {
  rkey: string;
  title: string | null;
  date: string;
  image: string | null;
}): ZetListItem {
  return {
    rkey: row.rkey,
    href: zetPath(row.rkey),
    heading: zetDisplayTitle(row),
    date: row.date,
    image: row.image,
  };
}
