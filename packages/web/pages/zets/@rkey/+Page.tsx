import React from "react";
import { useData } from "vike-react/useData";
import { clientOnly } from "vike-react/clientOnly";
import type data from "./+data";
import { ScrapboxBlock } from "@/pages/article/@title/components/ScrapboxBlock";
import { zetCanonical } from "../zetView";

// 反応は SSR に載せない (記事ページと同じ理由。エッジに 1 日載るため)。
const ReactionsIsland = clientOnly(
  () => import("@/pages/article/@title/components/Reactions"),
);

type Data = Awaited<ReturnType<typeof data>>;

const Page = () => {
  const d = useData<Data>();

  return (
    <main className="max-w-content mx-auto px-4 py-8">
      {/* h-entry は見出し・日付・本文まで。反応はこの外 (記事ページと同じ)。 */}
      <article className="h-entry">
        <div className="mb-8">
          <h1 className={`font-bold text-2xl ${d.hasTitle ? "p-name" : ""}`}>
            {d.heading}
          </h1>
          <p className="text-fg-subtle text-sm mt-1">
            <time className="dt-published" dateTime={d.date}>
              {d.date.replaceAll("-", "/")}
            </time>
          </p>
        </div>

        <a className="u-url" href={zetCanonical(d.rkey)} hidden>
          {d.heading}
        </a>
        <span className="p-author h-card" hidden>
          <a className="u-url" href="https://w.jgs.me/">
            <span className="p-name">jigsaw</span>
          </a>
        </span>

        <div className="e-content space-y-1">
          {d.blocks.map((block, i) => (
            <ScrapboxBlock key={i} block={block} />
          ))}
        </div>
      </article>

      <ReactionsIsland pageId={d.pageId} />
    </main>
  );
};

export default Page;
