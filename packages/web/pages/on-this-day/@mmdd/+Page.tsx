import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";

type Data = Awaited<ReturnType<typeof data>>;

const Page = () => {
  const d = useData<Data>();

  if (!d.ok) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">On This Day</h1>
        <p className="text-neutral-500">日付として読めない</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{d.label}</h1>

      {d.groups.length === 0 && (
        <p className="text-neutral-500">この日に書いた記事はまだ無い</p>
      )}

      {d.groups.map((group) => (
        <section key={group.year} className="mb-10">
          <h2 className="text-lg font-bold text-neutral-500 mb-3">
            {group.year}
          </h2>
          <ul className="space-y-2">
            {group.articles.map((article) => (
              <li key={article.title}>
                <a
                  href={`/pages/${encodeURIComponent(article.title)}`}
                  className="underline"
                >
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-12">
        <a href="/on-this-day" className="underline text-neutral-500">
          ← On This Day
        </a>
      </div>
    </main>
  );
};

export default Page;
