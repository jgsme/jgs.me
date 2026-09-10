import React from "react";
import { useState } from "react";
import type { Backlink } from "@/server/backlinks";
import { PageTileGrid } from "./PageTileGrid";

// 記事が無い題に出す「関連ページ」。最初の 12 件は SSR 済みで props から来る。
//
// Reactions と違って clientOnly にしない。ここは Not Found ページの中身その
// ものなので、HTML に載っていないと読む側にもクローラにも届かない。普通の
// コンポーネントとして SSR し、hydrate でボタンだけが動くようにする。
// JS が動かなければ最初の 12 件が出たままになる。
export const Backlinks: React.FC<{
  title: string;
  initial: Backlink[];
  initialHasMore: boolean;
}> = ({ title, initial, initialHasMore }) => {
  const [pages, setPages] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/backlinks?title=${encodeURIComponent(title)}&offset=${pages.length}`,
      );
      if (!res.ok) {
        // 続きが取れなくても、出ている分は読める。ボタンだけ引っ込める。
        setHasMore(false);
        return;
      }
      const json = (await res.json()) as {
        backlinks: Backlink[];
        hasMore: boolean;
      };
      setPages((prev) => [...prev, ...json.backlinks]);
      setHasMore(json.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTileGrid heading="関連ページ" pages={pages}>
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="text-sm border border-solid border-border px-3 py-1 rounded cursor-pointer disabled:cursor-default disabled:opacity-50"
          >
            {loading ? "読み込み中" : "もっと見る"}
          </button>
        </div>
      )}
    </PageTileGrid>
  );
};
