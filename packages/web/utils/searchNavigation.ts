import { useSyncExternalStore } from "react";
import { navigate } from "vike/client/router";

// 検索ページは client routing で遷移するので、AutoRAG を待つ間は前の結果が
// 出たままになり、押したのか分からない。遷移中は結果を消してインジケータを
// 出すため、検索フォーム (Layout 側) と結果ページで状態を共有する。
let pending = false;
const listeners = new Set<() => void>();

const setPending = (value: boolean) => {
  pending = value;
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSearchPending = () =>
  useSyncExternalStore(
    subscribe,
    () => pending,
    () => false,
  );

export async function navigateSearch(url: string): Promise<void> {
  setPending(true);
  try {
    await navigate(url);
  } finally {
    setPending(false);
  }
}
