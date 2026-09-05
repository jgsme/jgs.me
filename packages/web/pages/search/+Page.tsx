import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { SearchForm } from "../components/SearchForm";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      <SearchForm />
      {d.payload.query && (
        <p className="mb-4 text-fg-muted">
          「{d.payload.query}」の検索結果: {d.payload.results.length}件
        </p>
      )}

      <ul>
        {d.payload.results.map((result, i) => (
          <li key={i} className="my-6 pb-6 border-b border-border-subtle">
            <a
              href={`/pages/${encodeURIComponent(result.title)}`}
              className="block hover:opacity-70"
            >
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
