import React from "react";
import { useData } from "vike-react/useData";
import { tileImageSources } from "@/utils/listImage";
import { pdslsUrl } from "@jigsaw/db/zet";
import type data from "./+data";
import { SPOILER_LABEL } from "@/utils/spoiler";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      <ul>
        {d.payload.zets.map((zet) => (
          <li key={zet.rkey} className="border-b border-border-subtle">
            <a
              href={zet.href}
              className="flex gap-4 pt-6 pb-2 hover:opacity-70"
            >
              <div className="w-16 shrink-0">
                {zet.showDate && (
                  <time dateTime={zet.date} className="block leading-tight">
                    <span className="block text-fg-subtle text-xs">
                      {zet.year}
                    </span>
                    <span className="block font-bold text-lg">
                      {zet.monthDay}
                    </span>
                  </time>
                )}
              </div>
              {zet.image && (
                <img
                  {...tileImageSources(zet.image)}
                  alt={zet.heading}
                  className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                {zet.title && (
                  <div className="font-bold text-lg mb-1">{zet.title}</div>
                )}
                {zet.spoiler && (
                  <p className="text-fg-subtle text-sm">{SPOILER_LABEL}</p>
                )}
                {zet.excerpt && <p className="line-clamp-3">{zet.excerpt}</p>}
              </div>
            </a>
            <div className="flex gap-4 pb-6">
              <div className="w-16 shrink-0" />
              <a
                href={pdslsUrl(zet.atUri)}
                className="min-w-0 text-fg-subtle text-xs break-all hover:underline"
              >
                {zet.atUri}
              </a>
            </div>
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
