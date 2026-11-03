import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { formatDay } from "./timeline";
import { TimelineArticle } from "./TimelineArticle";
import {
  TimelineDay,
  contentColumnClass,
  dateColumnClass,
} from "./TimelineDay";

const newerHref = (page: number) => (page === 2 ? "/" : `/?p=${page - 1}`);

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  const { page, withYear, pinned, pinnedLabel, days, range, hasNext, hasPrev } =
    d.payload;

  return (
    <main className="px-4 pb-48">
      <div className="mx-auto sm:w-fit">
        {hasPrev && (
          <nav className="flex items-center justify-between gap-4 mb-6">
            <a href={newerHref(page)} className="block py-3 underline">
              新しい方へ
            </a>
            {range && (
              <span className="text-sm text-fg-muted">
                {range.newest}〜{range.oldest}
              </span>
            )}
          </nav>
        )}

        {/* 最新の日に article が無いときだけ、線の外に単体で置く。
            border-transparent は中身の列と左端を 1px まで揃えるため */}
        {pinned && (
          <div className="flex">
            <div className={dateColumnClass} />
            <div
              className={`${contentColumnClass} border-l border-transparent`}
            >
              <div>
                <time
                  dateTime={pinned.day}
                  className="block text-xs text-fg-muted"
                >
                  {pinnedLabel}
                </time>
                <TimelineArticle entry={pinned} />
              </div>
            </div>
          </div>
        )}

        {days.map((day) => (
          <TimelineDay
            key={day.day}
            day={day}
            label={formatDay(day.day, withYear)}
          />
        ))}

        <nav className="flex justify-between gap-4 mt-12">
          {hasPrev ? (
            <a href={newerHref(page)} className="block py-3 underline">
              新しい方へ
            </a>
          ) : (
            <div />
          )}
          {hasNext && (
            <a href={`/?p=${page + 1}`} className="block py-3 underline">
              もっと前へ
            </a>
          )}
        </nav>
      </div>
    </main>
  );
};

export default Page;
