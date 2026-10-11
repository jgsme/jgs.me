import { pageDisplayTitle } from "@jigsaw/db/zet";

// 記事ページの見出し (h1 / <title> / u-url の文字列)。
// zet の page.title は内部キー (zet:<rkey>) なので、zet.title、無ければ
// zet.date を出す。日付だけの見出しは題ではないので h-entry の p-name にしない。
export function articleHeading(row: {
  title: string;
  zetTitle: string | null;
  zetDate: string | null;
}): { heading: string; isName: boolean } {
  const heading = pageDisplayTitle(row);
  const isName =
    row.zetDate === null ||
    (row.zetTitle !== null && row.zetTitle.trim() !== "");
  return { heading, isName };
}
