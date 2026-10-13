import { useSyncExternalStore } from "react";
import type { SearchType } from "./searchResults";

// 検索ページは client routing で遷移するので、AutoRAG を待つ間は前の結果が
// 出たままになり、押したのか分からない。遷移中は結果を消してインジケータを
// 出すため、検索フォーム (Layout 側) と結果ページで行き先を共有する。
//
// 行き先を下ろすのは onPageTransitionEnd (pages/+onPageTransitionEnd.ts)。
// Vike は追い越された遷移ではこの hook を呼ばないので、連打しても最後の遷移の
// 描画が終わるまで立ったままになる。navigate() の resolve で下ろすと、
// 追い越された遷移の resolve で下りてしまい古い結果が見える。
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

export const startSearch = (next: SearchTarget) => setTarget(next);

export const endSearch = () => {
  if (target !== null) setTarget(null);
};

export function isSameSearch(a: SearchTarget, b: SearchTarget): boolean {
  return a.query === b.query && a.type === b.type;
}
