import React from "react";
import type { TimelineDay as Day, TimelineEntry } from "./timeline";
import { TimelineArticle } from "./TimelineArticle";
import { Tile } from "./Tile";

// 日付の列と中身の列。PinnedArticle も同じ幅で並べるので、列のクラスはここに集める。
export const dateColumnClass = "w-12 sm:w-24 shrink-0 pr-3 sm:pr-4 text-right";
export const contentColumnClass =
  "relative min-w-0 flex-1 sm:flex-none sm:w-content pl-4 sm:pl-6 pb-12 flex flex-col gap-6";

const TextEntry = ({ entry }: { entry: TimelineEntry }) => {
  if (entry.kind !== "zet") {
    return (
      <a href={entry.href} className="block text-sm">
        {entry.title}
      </a>
    );
  }
  // 題の無い zet は title に抜粋が入っているので、同じ文を 2 回出さない
  return (
    <a href={entry.href} className="block border-l-2 border-border pl-3">
      {entry.title !== entry.excerpt && (
        <div className="font-bold">{entry.title}</div>
      )}
      {entry.excerpt && (
        <div className="text-sm sm:text-base text-fg-muted line-clamp-3">
          {entry.excerpt}
        </div>
      )}
    </a>
  );
};

export const TimelineDay = ({ day, label }: { day: Day; label: string }) => (
  <section className="flex">
    <div className={dateColumnClass}>
      <time
        dateTime={day.day}
        className="block text-xs sm:text-sm font-bold sm:sticky sm:top-4"
      >
        {label}
      </time>
    </div>
    <div className={`${contentColumnClass} border-l border-border`}>
      <span className="timeline-mark" aria-hidden />
      {/* スマホは 1 行目に日付と三角だけを出し、article をその下に端まで広げる */}
      {day.articles.length > 0 && <div className="h-6 sm:hidden" />}
      {day.articles.map((entry) => (
        <TimelineArticle key={entry.key} entry={entry} />
      ))}
      {day.tiles.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {day.tiles.map((entry) => (
            <li key={entry.key}>
              <Tile href={entry.href} label={entry.title} image={entry.image} />
            </li>
          ))}
        </ul>
      )}
      {day.texts.map((entry) => (
        <TextEntry key={entry.key} entry={entry} />
      ))}
    </div>
  </section>
);
