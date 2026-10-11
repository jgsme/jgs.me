import { zetDisplayTitle, zetPath } from "@jigsaw/db/zet";
import { SITE_URL } from "@/constants/site";

export type ZetListItem = {
  rkey: string;
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

// h-entry の u-url と og:url。Webmention の source (ap の pageURL) と同じ URL。
export function zetCanonical(rkey: string): string {
  return `${SITE_URL}${zetPath(rkey)}`;
}
