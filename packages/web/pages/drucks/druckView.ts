import { pagePath } from "@jigsaw/db/page-path";

export type DruckListItem = {
  id: number;
  title: string;
  // druck の記事ページは /pages/<題> のまま (/d/:id は共有用の短縮 URL)。
  href: string;
  image: string | null;
};

type Row = {
  id: number;
  title: string;
  image: string | null;
};

export function toDruckList(rows: readonly Row[]): DruckListItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    href: pagePath(row.title),
    image: row.image,
  }));
}

// 1 ページ目は ?p=1 を作らず /drucks に寄せる (キャッシュキーを 1 つにする)。
export function druckPageLinks(page: number, hasNext: boolean) {
  return {
    prev: page <= 1 ? null : page === 2 ? "/drucks" : `/drucks?p=${page - 1}`,
    next: hasNext ? `/drucks?p=${page + 1}` : null,
  };
}
