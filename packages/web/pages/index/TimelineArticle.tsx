import React from "react";
import { timelineArticleImageSources } from "@/utils/listImage";
import type { TimelineEntry } from "./timeline";

// スマホでは画面の左右の端まで広げる。外側の -ml-16 は日付の列 (w-12) と中身の列の pl-4、
// 内側の -ml-4 と外側の -mr-4 は main の px-4 のぶん。合計 5rem は語彙に無いので 2 段に分けている。
// 縦線を横切るので bg-bg で線を隠す。
export const TimelineArticle = ({ entry }: { entry: TimelineEntry }) => (
  <div className="relative bg-bg -ml-16 -mr-4 sm:mx-0">
    <a
      href={entry.href}
      className="-ml-4 sm:ml-0 mt-2 mb-6 flex flex-col gap-2"
    >
      {entry.image ? (
        <img
          {...timelineArticleImageSources(entry.image)}
          alt={entry.title}
          className="h-64 sm:h-96 w-full object-contain sm:rounded"
          loading="lazy"
        />
      ) : (
        <div className="h-64 sm:h-96 flex items-center justify-center bg-surface-strong sm:rounded text-2xl sm:text-3xl font-bold text-center p-4">
          {entry.title}
        </div>
      )}
      <div className="text-2xl sm:text-3xl font-bold px-4 sm:px-0">
        {entry.title}
      </div>
    </a>
  </div>
);
