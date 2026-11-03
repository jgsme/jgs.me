import React from "react";
import type { TimelineDay as Day, TimelineEntry } from "./timeline";
import { TimelineArticle } from "./TimelineArticle";
import { Tile } from "./Tile";

// 日付の列と中身の列。先頭に固定する article も同じ幅で並べるので、列のクラスはここに集める。
// PC の中身の列は w-content (48rem) を上限に、640〜896px では flex-initial で縮める
// (外側の sm:w-fit sm:max-w-full と組み合わせて横スクロールを出さない)。
export const dateColumnClass = "w-12 sm:w-24 shrink-0 pr-3 sm:pr-4 text-right";
export const contentColumnClass =
  "relative min-w-0 flex-1 sm:flex-initial sm:w-content pl-4 sm:pl-6 pb-12 flex flex-col gap-6";

// 縦線はスマホでは日付の列の右の線、PC では中身の列の左の線として引く。
// スマホで中身の列に線を持たせると、端まで広げる article の計算に 1px の端数が出るため。
// どちらでも線は中身の列の左端のすぐ外 (1px) にあるので、.timeline-mark の位置は変わらない。
const dateLineClass = "border-r border-border sm:border-r-0";
const contentLineClass = "sm:border-l sm:border-border";

// 文字だけの zet / clip はカードにして、タイルと同じく押せる塊に見せる。
// 左の正方形は種別の印 (zet はマーク、clip は鎖)。カード全体が 44px 以上の高さになる。
const LinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="w-6 h-6"
  >
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);

const TextEntry = ({ entry }: { entry: TimelineEntry }) => {
  const isZet = entry.kind === "zet";
  return (
    <a
      href={entry.href}
      className="flex gap-3 sm:gap-4 items-start p-3 border border-border-subtle rounded transition-shadow hover:shadow-md"
    >
      <div
        className={`shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded flex items-center justify-center ${
          isZet ? "bg-brand" : "bg-surface-strong text-fg-muted"
        }`}
      >
        {isZet ? (
          <img src="/mark.svg" alt="" className="w-6 sm:w-8" />
        ) : (
          <LinkIcon />
        )}
      </div>
      <div className="min-w-0 flex-1 break-words">
        {isZet ? (
          <>
            {/* 題の無い zet は title に抜粋が入っているので、同じ文を 2 回出さない */}
            {entry.title !== entry.excerpt && (
              <div className="font-bold">{entry.title}</div>
            )}
            {entry.excerpt && (
              <div className="text-sm text-fg-muted line-clamp-3">
                {entry.excerpt}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm font-bold">{entry.title}</div>
        )}
      </div>
    </a>
  );
};

export const TimelineDay = ({
  day,
  label,
  eagerFirstArticle = false,
}: {
  day: Day;
  label: string;
  eagerFirstArticle?: boolean;
}) => (
  <section className="flex">
    <div className={`${dateColumnClass} ${dateLineClass}`}>
      <time
        dateTime={day.day}
        className="block text-xs sm:text-sm font-bold sm:sticky sm:top-4"
      >
        {label}
      </time>
    </div>
    <div className={`${contentColumnClass} ${contentLineClass}`}>
      <span className="timeline-mark" aria-hidden />
      {/* スマホは 1 行目に日付と三角だけを出し、article をその下に端まで広げる */}
      {day.articles.length > 0 && <div className="h-6 sm:hidden" />}
      {day.articles.map((entry, i) => (
        <TimelineArticle
          key={entry.key}
          entry={entry}
          eager={eagerFirstArticle && i === 0}
        />
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
      {day.texts.length > 0 && (
        <div className="flex flex-col gap-3">
          {day.texts.map((entry) => (
            <TextEntry key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </div>
  </section>
);
