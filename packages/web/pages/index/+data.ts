import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { buildArticleBody } from "@/pages/article/@title/articleBody";
import {
  formatDay,
  groupByDay,
  pinLatestArticle,
  type TimelineDay,
  type TimelineEntry,
} from "./timeline";
import {
  fetchDayWindow,
  fetchEntriesInRange,
  fetchLatestArticle,
} from "./timelineQuery";
import { parsePage, toPageEntry, toZetEntry } from "./toEntries";

type Context = PageContextServer & {
  env: Bindings;
};

type Payload = {
  page: number;
  withYear: boolean;
  pinned: TimelineEntry | null;
  pinnedLabel: string | null;
  days: TimelineDay[];
  hasNext: boolean;
  hasPrev: boolean;
};

// 「今年」は JST で判定する (Workers は UTC で動くため +9 時間する)
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const currentYearJst = () =>
  new Date(Date.now() + JST_OFFSET_MS).getUTCFullYear();

const data = async (c: Context): Promise<{ ok: true; payload: Payload }> => {
  const db = getDB(c.env.DB);
  const page = parsePage(c.urlParsed.search.p);
  const withYear = page > 1;
  const hasPrev = page > 1;

  const { days: window, hasNext } = await fetchDayWindow(db, page);
  if (window.length === 0) {
    return {
      ok: true,
      payload: {
        page,
        withYear,
        pinned: null,
        pinnedLabel: null,
        days: [],
        hasNext: false,
        hasPrev,
      },
    };
  }
  const newest = window[0];
  const oldest = window[window.length - 1];

  const [rows, latest] = await Promise.all([
    fetchEntriesInRange(db, oldest, newest),
    page === 1 ? fetchLatestArticle(db) : Promise.resolve(null),
  ]);

  // 抜粋は画像の無い zet と題の無い zet にだけ、読む時に本文から作る (/zets と同じ)。
  // ネタバレは抜粋を出さないので本文も読まない
  const zetEntries = await Promise.all(
    rows.zets.map(async (z) => {
      const needs =
        !z.spoiler &&
        (z.image === null || z.zetTitle === null || z.zetTitle.trim() === "");
      if (!needs) return toZetEntry(z, null);
      const body = await fetchBody(c.env.R2, z.bodyKey, z.title);
      const text =
        body === null ? "" : buildArticleBody(body).description.trim();
      return toZetEntry(z, text === "" ? null : text);
    }),
  );

  const entries: TimelineEntry[] = [
    ...rows.articles.map((r) => toPageEntry("article", r)),
    ...zetEntries,
    ...rows.clips.map((r) => toPageEntry("clip", r)),
    ...rows.drucks.map((r) => toPageEntry("druck", r)),
  ];

  const { pinned, days } = pinLatestArticle(
    groupByDay(entries),
    latest ? toPageEntry("article", latest) : null,
  );
  const pinnedLabel = pinned
    ? formatDay(pinned.day, !pinned.day.startsWith(`${currentYearJst()}-`))
    : null;

  return {
    ok: true,
    payload: {
      page,
      withYear,
      pinned,
      pinnedLabel,
      days,
      hasNext,
      hasPrev,
    },
  };
};

export default data;
