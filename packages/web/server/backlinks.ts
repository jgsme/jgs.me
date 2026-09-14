import { and, desc, eq, exists, or, sql } from "drizzle-orm";
import { articles, clips, pageLinks, pages } from "@jigsaw/db";
import type { getDB } from "@/db/getDB";

export type Backlink = {
  title: string;
  image: string | null;
};

// SSR で最初に出す枚数と、「もっと見る」1 回分の枚数。
// 実測 (2026-09-11) では被リンクを持つ題の 99% が 12 件以下なので、
// ボタンが出るのは一握りの題だけ。最大は 75 件で、24 を 1 回押せば出切る。
export const BACKLINK_INITIAL = 12;
export const BACKLINK_PAGE = 24;

// 「この題にリンクしているページ」を新しい順に引く。
//
// 出すのは article か clip に載っているページだけ。page 行はあるが
// どちらにも登録していないページ (実測 1351 件) は、一覧にもクリップにも
// 出てこない下書き相当なので、カードにも出さない。
// excluded_page は article / clip と重なりが 0 件なので、この条件で自然に落ちる。
//
// 並びは updated の降順。同値がほぼ無いとはいえ (6234 件中 1 組)、offset で
// ページを繰る以上は順序が確定していないと取りこぼす。id を第 2 キーに置く。
export async function fetchBacklinks(
  db: ReturnType<typeof getDB>,
  title: string,
  offset: number,
  limit: number,
): Promise<{ backlinks: Backlink[]; hasMore: boolean }> {
  // limit + 1 件取って、余ったかどうかで続きの有無を決める。
  // 別途 COUNT(*) を打つより 1 クエリ安い。
  const rows = await db
    .select({ title: pages.title, image: pages.image })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.fromPageID))
    .where(
      and(
        eq(pageLinks.toTitle, title),
        or(
          exists(
            db
              .select({ one: sql`1` })
              .from(articles)
              .where(eq(articles.pageID, pages.id)),
          ),
          exists(
            db
              .select({ one: sql`1` })
              .from(clips)
              .where(eq(clips.pageID, pages.id)),
          ),
        ),
      ),
    )
    .orderBy(desc(pages.updated), desc(pages.id))
    .limit(limit + 1)
    .offset(offset);

  return { backlinks: rows.slice(0, limit), hasMore: rows.length > limit };
}
