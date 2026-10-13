import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { pagePath } from "@jigsaw/db/page-path";
import { searchPath, type SearchType } from "@/utils/searchResults";

const FILTERS: { type: SearchType | null; label: string }[] = [
  { type: null, label: "すべて" },
  { type: "article", label: "記事" },
  { type: "clip", label: "クリップ" },
];

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      {d.payload.query && (
        <nav className="flex gap-2 mb-4" aria-label="種別で絞り込む">
          {FILTERS.map((f) => {
            const current = f.type === d.payload.type;
            return (
              <a
                key={f.label}
                href={searchPath(d.payload.query, f.type)}
                aria-current={current ? "page" : undefined}
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

      {d.payload.query && (
        <p className="mb-4 text-fg-muted">
          「{d.payload.query}」の検索結果: {d.payload.results.length}件
        </p>
      )}

      <ul>
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

      {d.payload.query && d.payload.results.length === 0 && (
        <p className="text-fg-muted">検索結果が見つかりませんでした</p>
      )}
    </main>
  );
};

export default Page;
