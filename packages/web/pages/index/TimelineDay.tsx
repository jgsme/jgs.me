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

const TextEntry = ({ entry }: { entry: TimelineEntry }) => {
  if (entry.kind !== "zet") {
    return (
      <a href={entry.href} className="block py-3 text-sm break-words">
        {entry.title}
      </a>
    );
  }
  // 押せる高さを 44px 以上取るため py-3 を付ける (線は内側の div に引いて伸ばさない)。
  // 題の無い zet は title に抜粋が入っているので、同じ文を 2 回出さない
  return (
    <a href={entry.href} className="block py-3 break-words">
      <div className="border-l-2 border-border pl-3">
        {entry.title !== entry.excerpt && (
          <div className="font-bold">{entry.title}</div>
        )}
        {entry.excerpt && (
          <div className="text-sm sm:text-base text-fg-muted line-clamp-3">
            {entry.excerpt}
          </div>
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
      {/* 行どうしは py-3 の上下 12px ずつで 24px 空く。外側の gap-6 と重なるぶんを -my-3 で戻す */}
      {day.texts.length > 0 && (
        <div className="-my-3 flex flex-col">
          {day.texts.map((entry) => (
            <TextEntry key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </div>
  </section>
);
