import React from "react";
import { useData } from "vike-react/useData";
import { cardImageSources } from "@/utils/listImage";
import type data from "./+data";
import { TileSection } from "./TileSection";
import { pagePath } from "@jigsaw/db/page-path";
import { zetDisplayTitle, zetPath } from "@jigsaw/db/zet";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      <ul>
        {d.payload.articles.map((article, i) => (
          <React.Fragment key={article.id}>
            <li className="my-8">
              <a href={pagePath(article.title ?? "")}>
                {article.image ? (
                  <img
                    {...cardImageSources(article.image)}
                    alt={article.title ?? ""}
                    className="mb-2 rounded mx-auto h-96 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-96 text-center mx-auto font-bold flex justify-center items-center bg-black/[0.04] mb-2 rounded text-4xl">
                    {article.title}
                  </div>
                )}
                <div className="font-bold text-xl">{article.title}</div>
              </a>
            </li>
            {/* 最新記事を 3 件見せてから zet と clip を挟む。先頭に置くと
                記事より目立ち、末尾だと誰も辿り着かない。 */}
            {i === 2 && (
              <li className="my-12 divide-y divide-black/10 border-y border-black/10 empty:hidden">
                <TileSection
                  heading="Zettelkasten"
                  tiles={d.payload.recentZets.map((zet) => ({
                    key: zet.rkey,
                    href: zetPath(zet.rkey),
                    label: zetDisplayTitle(zet),
                    image: zet.image,
                  }))}
                  moreHref="/zets"
                  moreLabel="Zettelkasten をもっと見る"
                />
                <TileSection
                  heading="クリップ"
                  tiles={d.payload.recentClips.map((clip) => ({
                    key: clip.id,
                    href: pagePath(clip.title),
                    label: clip.title,
                    image: clip.image,
                  }))}
                  moreHref="/clips"
                  moreLabel="クリップをもっと見る"
                />
              </li>
            )}
          </React.Fragment>
        ))}
      </ul>

      <div className="flex justify-between mt-24">
        {d.payload.page === 1 && <div />}
        {d.payload.page === 2 && (
          <a href="/" className="block underline">
            前のページ
          </a>
        )}
        {d.payload.page > 2 && (
          <a href={`/?p=${d.payload.page - 1}`} className="block underline">
            前のページ
          </a>
        )}
        {d.payload.hasNext && (
          <a href={`/?p=${d.payload.page + 1}`} className="block underline">
            次のページ
          </a>
        )}
      </div>
    </main>
  );
};

export default Page;
