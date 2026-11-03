import React from "react";
import { timelineArticleImageSources } from "@/utils/listImage";
import type { TimelineEntry } from "./timeline";

// スマホでは画面の左右の端まで広げる。中身の列の content box の左端は
// main の px-4 (1rem) + 日付の列 w-12 (3rem、線はこの中の border-r) + pl-4 (1rem) = 5rem。
// 外側の -ml-16 で 4rem、内側の -ml-4 で 1rem 戻して x=0 に付ける (5rem は語彙に無いので 2 段)。
// 右は外側の -mr-4 で main の px-4 を戻す。縦線を横切るので bg-bg で線を隠す。
export const TimelineArticle = ({
  entry,
  eager = false,
}: {
  entry: TimelineEntry;
  eager?: boolean;
}) => (
  <div className="relative bg-bg -ml-16 -mr-4 sm:mx-0">
    <a
      href={entry.href}
      className="-ml-4 sm:ml-0 mt-2 mb-6 flex flex-col gap-2"
    >
      {entry.image ? (
        <img
          {...timelineArticleImageSources(entry.image)}
          alt=""
          className="h-64 sm:h-96 w-full object-contain sm:rounded"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
        />
      ) : (
        <div className="h-64 sm:h-96 flex items-center justify-center bg-surface-strong sm:rounded text-2xl sm:text-3xl font-bold text-center p-4">
          {entry.title}
        </div>
      )}
      <div className="text-xl font-bold px-4 sm:px-0">{entry.title}</div>
    </a>
  </div>
);
