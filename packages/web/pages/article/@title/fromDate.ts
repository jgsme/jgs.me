import { bodyFormatOf } from "@jigsaw/db/body-key";
import { jstDate } from "@/utils/jstDate";

type Input = {
  // 本文から取れた日付 ("YYYY/MM/DD")。取れなければ null。
  bodyDate: string | null;
  title: string;
  bodyKey: string;
  created: string;
};

// 記事に出す日付を決める。本文 > タイトル > page.created の順。
// created を使うのは Micropub 由来のページだけ。Scrapbox アーカイブ由来の
// created はインポート時刻で、記事が書かれた日ではない。
export function resolveFromDate({
  bodyDate,
  title,
  bodyKey,
  created,
}: Input): string | null {
  if (bodyDate) return bodyDate;

  const titleDateMatch = title.match(/(\d{4})(\d{2})(\d{2})/);
  if (titleDateMatch) {
    const [, year, month, day] = titleDateMatch;
    return `${year}/${month}/${day}`;
  }

  if (bodyFormatOf(bodyKey) === "micropub-sb") return jstDate(created);

  return null;
}
