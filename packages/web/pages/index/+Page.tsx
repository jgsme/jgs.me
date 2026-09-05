import React from "react";
import { useData } from "vike-react/useData";
import { cardImageSources } from "@/utils/listImage";
import type data from "./+data";
import { SearchForm } from "../components/SearchForm";
import { TodayLink } from "../components/TodayLink";
import { ClipsSection } from "./ClipsSection";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-page-end">
      <div className="flex gap-4 my-2">
        <div className="grow">
          <SearchForm />
        </div>
        <div>
          <TodayLink />
        </div>
      </div>
      <ul>
        {d.payload.articles.map((article, i) => (
          <React.Fragment key={article.id}>
            <li className="my-8">
              <a href={`/pages/${encodeURIComponent(article.title ?? "")}`}>
                {article.image ? (
                  <img
                    {...cardImageSources(article.image)}
                    alt={article.title ?? ""}
                    className="mb-2 rounded mx-auto h-hero object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-hero text-center mx-auto font-bold flex justify-center items-center bg-black/[0.04] mb-2 rounded text-4xl">
                    {article.title}
                  </div>
                )}
                <div className="font-bold text-xl">{article.title}</div>
              </a>
            </li>
            {/* 最新記事を 3 件見せてから clip を挟む。先頭に置くと
                記事より clip が目立ち、末尾だと誰も辿り着かない。 */}
            {i === 2 && (
              <li>
                <ClipsSection clips={d.payload.recentClips} />
              </li>
            )}
          </React.Fragment>
        ))}
      </ul>

      <div className="flex justify-between mt-20">
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
