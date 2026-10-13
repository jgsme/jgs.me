import { endSearch } from "@/utils/searchNavigation";

// 検索の遷移中表示を下ろす。Vike は離れる側のページの hook を呼ぶので、
// 検索ページ以外からの検索 (Layout の検索フォーム) も拾えるよう全ページに置く。
export const onPageTransitionEnd = () => {
  endSearch();
};
