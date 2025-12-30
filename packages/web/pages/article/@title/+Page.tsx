import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { ScrapboxBlock } from "./components/ScrapboxBlock";
import { CopyButton } from "./components/CopyButton";

type Data = Awaited<ReturnType<typeof data>>;

const Page = () => {
  const d = useData<Data>();

  if (!d.ok) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{d.title}</h1>
        <p className="text-neutral-500">Page not found</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{d.title}</h1>
        <div className="flex gap-2">
          {d.fromDate && (
            <p className="text-neutral-500 text-sm mt-1">{d.fromDate}</p>
          )}
          <CopyButton articleId={d.articleId} />
        </div>
      </div>
      <article className="space-y-1">
        {d.blocks.map((block, i) => (
          <ScrapboxBlock key={i} block={block} />
        ))}
      </article>
      {/^\d{4}$/.test(d.title) && (
        <div className="mt-12 flex justify-center">
          <a
            href="/on-this-day"
            className="group relative inline-flex items-center justify-center px-16 py-8 font-bold text-white transition-all duration-300 bg-neutral-900 rounded-full overflow-hidden hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 w-full h-full bg-[url('/warp.gif')] bg-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 text-5xl">WARP</span>
          </a>
        </div>
      )}
    </main>
  );
};

export default Page;
