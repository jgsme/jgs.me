import React from "react";
import { useData } from "vike-react/useData";
import { cardImageSources } from "@/utils/listImage";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      <ul>
        {d.payload.zets.map((zet) => (
          <li key={zet.rkey} className="my-8">
            <a href={zet.href}>
              {zet.image && (
                <img
                  {...cardImageSources(zet.image)}
                  alt={zet.heading}
                  className="mb-2 rounded mx-auto h-96 object-contain"
                  loading="lazy"
                />
              )}
              <div className="font-bold text-xl">{zet.heading}</div>
              {zet.heading !== zet.date && (
                <time className="text-fg-subtle text-sm" dateTime={zet.date}>
                  {zet.date.replaceAll("-", "/")}
                </time>
              )}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex justify-between mt-24">
        {d.payload.page === 1 && <div />}
        {d.payload.page === 2 && (
          <a href="/zets" className="block underline">
            前のページ
          </a>
        )}
        {d.payload.page > 2 && (
          <a href={`/zets?p=${d.payload.page - 1}`} className="block underline">
            前のページ
          </a>
        )}
        {d.payload.hasNext && (
          <a href={`/zets?p=${d.payload.page + 1}`} className="block underline">
            次のページ
          </a>
        )}
      </div>
    </main>
  );
};

export default Page;
