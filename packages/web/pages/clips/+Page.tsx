import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-[600px] mx-auto px-4 pb-[200px]">
      <ul>
        {d.payload.clips.map((clip) => (
          <li key={clip.id} className="my-8">
            <a href={`/pages/${encodeURIComponent(clip.title ?? "")}`}>
              {clip.image ? (
                <img
                  src={
                    clip.image.includes("gyazo.com")
                      ? clip.image.replace("/raw", "/thumb/400")
                      : clip.image
                  }
                  alt={clip.title ?? ""}
                  className="mb-2 rounded mx-auto h-[300px] object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="h-[300px] text-center mx-auto font-bold flex justify-center items-center bg-black/[0.04] mb-2 rounded text-[2rem]">
                  {clip.title}
                </div>
              )}
              <div className="font-bold text-[1.2rem]">{clip.title}</div>
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
          <a href={`/clips?p=${d.payload.page - 1}`} className="block underline">
            前のページ
          </a>
        )}
        {d.payload.hasNext && (
          <a href={`/clips?p=${d.payload.page + 1}`} className="block underline">
            次のページ
          </a>
        )}
      </div>
    </main>
  );
};

export default Page;
