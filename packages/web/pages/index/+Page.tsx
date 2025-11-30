import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-[600px] mx-auto px-4 pb-[200px]">
      <ul>
        {d.payload.articles.map((article) => (
          <li key={article.id} className="my-8">
            <a href={`/pages/${encodeURIComponent(article.title ?? "")}`}>
              {article.image ? (
                <img
                  src={
                    article.image.includes("gyazo.com")
                      ? article.image.replace("/raw", "/thumb/400")
                      : article.image
                  }
                  alt={article.title ?? ""}
                  className="mb-2 rounded mx-auto h-[300px] object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="h-[300px] text-center mx-auto font-bold flex justify-center items-center bg-black/[0.04] mb-2 rounded text-[2rem]">
                  {article.title}
                </div>
              )}
              <div className="font-bold text-[1.2rem]">{article.title}</div>
            </a>
          </li>
        ))}
      </ul>

      <div className="flex justify-between mt-[80px]">
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
