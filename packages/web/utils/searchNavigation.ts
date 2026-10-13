import { useSyncExternalStore } from "react";
import { navigate } from "vike/client/router";
import { searchPath, type SearchType } from "./searchResults";

// 検索ページは client routing で遷移するので、AutoRAG を待つ間は前の結果が
// 出たままになり、押したのか分からない。遷移中は結果を消してインジケータを
// 出すため、検索フォーム (Layout 側) と結果ページで行き先を共有する。
//
// 切り替えを連打すると、追い越された古い遷移の navigate() も resolve する。
// そこで下ろすとまだ届いていない行き先の代わりに古い結果が見えるので、
// 下ろすのは最後に始めた遷移が終わったときだけ。結果ページ側も描画中の
// データが行き先と一致するまでは結果を出さない。
export type SearchTarget = { query: string; type: SearchType | null };

let target: SearchTarget | null = null;
const listeners = new Set<() => void>();

const setTarget = (value: SearchTarget | null) => {
  target = value;
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSearchTarget = () =>
  useSyncExternalStore(
    subscribe,
    () => target,
    () => null,
  );

export function isSameSearch(a: SearchTarget, b: SearchTarget): boolean {
  return a.query === b.query && a.type === b.type;
}

export async function navigateSearch(next: SearchTarget): Promise<void> {
  setTarget(next);
  try {
    await navigate(searchPath(next.query, next.type));
  } finally {
    if (target === next) setTarget(null);
  }
}
