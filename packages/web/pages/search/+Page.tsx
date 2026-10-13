import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { pagePath } from "@jigsaw/db/page-path";
import { searchPath, type SearchType } from "@/utils/searchResults";
import {
  isSameSearch,
  startSearch,
  useSearchTarget,
} from "@/utils/searchNavigation";

const FILTERS: { type: SearchType | null; label: string }[] = [
  { type: null, label: "すべて" },
  { type: "article", label: "記事" },
  { type: "clip", label: "クリップ" },
];

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  const target = useSearchTarget();
  const shown = { query: d.payload.query, type: d.payload.type };
  // 描画中のデータが行き先と一致するまでは古い結果なので出さない。
  const pending = target !== null && !isSameSearch(target, shown);
  // 押した filter を結果が届く前から選択中に見せる。
  const selected = target !== null ? target.type : d.payload.type;

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      {d.payload.query && (
        <nav className="flex gap-2 mb-4" aria-label="種別で絞り込む">
          {FILTERS.map((f) => {
            const current = f.type === selected;
            return (
              <a
                key={f.label}
                href={searchPath(d.payload.query, f.type)}
                aria-current={current ? "page" : undefined}
                onClick={(e) => {
                  // 修飾キー付きは新しいタブなどブラウザに任せる。
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  // 遷移そのものは Vike のリンク処理に任せる。ここで
                  // navigate() も呼ぶと同じ URL への遷移が 2 本走り、互いに
                  // 打ち消して古い結果に戻る。
                  startSearch({ query: d.payload.query, type: f.type });
                }}
                className={`px-3 py-1 rounded border border-solid ${
                  current
                    ? "border-border-strong bg-surface-strong"
                    : "border-border hover:bg-surface"
                }`}
              >
                {f.label}
              </a>
            );
          })}
        </nav>
      )}

      {pending && (
        <div
          role="status"
          className="flex justify-center items-center gap-3 py-16 text-fg-muted"
        >
          <span
            aria-hidden="true"
            className="w-4 h-4 rounded-full border-2 border-border border-t-fg-muted animate-spin"
          />
          検索中…
        </div>
      )}

      {!pending && d.payload.query && (
        <p className="mb-4 text-fg-muted">
          「{d.payload.query}」の検索結果: {d.payload.results.length}件
        </p>
      )}

      <ul hidden={pending}>
        {d.payload.results.map((result, i) => (
          <li key={i} className="my-6 pb-6 border-b border-border-subtle">
            <a href={pagePath(result.title)} className="block hover:opacity-70">
              <div className="font-bold text-lg mb-2">{result.title}</div>
              <p className="text-fg-muted text-sm line-clamp-3">
                {result.snippet}
              </p>
            </a>
          </li>
        ))}
      </ul>

      {!pending && d.payload.query && d.payload.results.length === 0 && (
        <p className="text-fg-muted">検索結果が見つかりませんでした</p>
      )}
    </main>
  );
};

export default Page;
