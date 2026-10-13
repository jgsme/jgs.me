import React, { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { pagePath } from "@jigsaw/db/page-path";
import { searchPath, type SearchType } from "@/utils/searchResults";
import { navigateSearch, useSearchPending } from "@/utils/searchNavigation";

const FILTERS: { type: SearchType | null; label: string }[] = [
  { type: null, label: "すべて" },
  { type: "article", label: "記事" },
  { type: "clip", label: "クリップ" },
];

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  const pending = useSearchPending();
  // 押した filter を結果が届く前から選択中に見せる。
  const [selected, setSelected] = useState(d.payload.type);
  useEffect(() => setSelected(d.payload.type), [d]);

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
                  e.preventDefault();
                  setSelected(f.type);
                  void navigateSearch(e.currentTarget.href);
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
