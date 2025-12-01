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

  let lineCount = 0;
  const filteredBlocks = d.blocks.filter((block, index) => {
    if (block.type === "title") return false;
    if (block.type === "line" && d.skipLines > 0) {
      lineCount++;
      if (lineCount <= d.skipLines) return false;
    }
    if (d.dateLineIndex !== null && index === d.dateLineIndex) return false;
    return true;
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{d.title}</h1>
          {d.fromDate && (
            <p className="text-neutral-500 text-sm mt-1">{d.fromDate}</p>
          )}
        </div>
        <CopyButton articleId={d.articleId} />
      </div>
      <article className="space-y-1">
        {filteredBlocks.map((block, i) => (
          <ScrapboxBlock key={i} block={block} />
        ))}
      </article>
    </main>
  );
};

export default Page;
