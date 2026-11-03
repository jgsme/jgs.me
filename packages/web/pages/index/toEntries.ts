import { pagePath } from "@jigsaw/db/page-path";
import { zetDisplayTitle, zetPath } from "@jigsaw/db/zet";
import type { TimelineEntry } from "./timeline";
import type { PageRow, ZetRow } from "./timelineQuery";

// ?p= を 1 以上の整数にする。読めない値は 1 ページ目
const MAX_PAGE = 100000;

export function parsePage(p: unknown): number {
  const n = Math.floor(Number(p));
  if (!Number.isSafeInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export function toPageEntry(
  kind: "article" | "clip" | "druck",
  row: PageRow,
): TimelineEntry {
  return {
    kind,
    key: `${kind}:${row.id}`,
    day: row.day,
    created: row.created,
    href: pagePath(row.title),
    title: row.title,
    image: row.image,
    excerpt: null,
  };
}

// row.title は内部キー (zet:<rkey>) なので表示に使わない。
// ネタバレは抜粋を出さず、題の代わりにもしない
export function toZetEntry(row: ZetRow, excerpt: string | null): TimelineEntry {
  const safe = row.spoiler ? null : excerpt;
  const hasTitle = row.zetTitle !== null && row.zetTitle.trim() !== "";
  const title =
    hasTitle || safe === null
      ? zetDisplayTitle({ title: row.zetTitle, date: row.zetDate })
      : safe;
  return {
    kind: "zet",
    key: `zet:${row.rkey}`,
    day: row.day,
    created: row.created,
    href: zetPath(row.rkey),
    title,
    image: row.image,
    excerpt: safe,
  };
}
