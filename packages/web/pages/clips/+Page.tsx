import React from "react";
import { useData } from "vike-react/useData";
import { cardImageSources } from "@/utils/listImage";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-[600px] mx-auto px-4 pb-[200px]">
      <ul>
        {d.payload.clips.map((clip) => (
          <li key={clip.id} className="my-8">
            <a href={`/pages/${encodeURIComponent(clip.title)}`}>
              {clip.image && (
                <img
                  {...cardImageSources(clip.image)}
                  alt={clip.title}
                  className="mb-2 rounded mx-auto h-[300px] object-contain"
                  loading="lazy"
                />
              )}
              <div className="font-bold text-[1.2rem]">{clip.title}</div>
              {clip.description && (
                <div className="mt-1 text-[0.9rem] text-black/60 line-clamp-2">
                  {clip.description}
                </div>
              )}
              {clip.hostname && (
                <div className="mt-1 text-[0.8rem] text-black/40">
                  {clip.hostname}
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex justify-between mt-[80px]">
        {d.payload.page === 1 && <div />}
        {d.payload.page === 2 && (
          <a href="/clips" className="block underline">
            前のページ
          </a>
        )}
        {d.payload.page > 2 && (
          <a
            href={`/clips?p=${d.payload.page - 1}`}
            className="block underline"
          >
            前のページ
          </a>
        )}
        {d.payload.hasNext && (
          <a
            href={`/clips?p=${d.payload.page + 1}`}
            className="block underline"
          >
            次のページ
          </a>
        )}
      </div>
    </main>
  );
};

export default Page;
