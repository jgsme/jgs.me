import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq, isNull } from "drizzle-orm";
import { pages, articles, onThisDayEntries } from "@jigsaw/db";
import { resolveArticleDate } from "@jigsaw/db/article-date";
import { fetchBody } from "@jigsaw/db/fetch-body";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
  WORKFLOW: Workflow;
};

type BackfillParams = {
  // true なら on_this_day_entry に載っていない article も対象にする。
  // 既定は false で、載っているものだけを埋める。
  includeUnlisted?: boolean;
  // 1 バッチあたりの件数。Workflow の step 上限に合わせて調整する。
  batchSize?: number;
};

// "0401" + 2022 -> "2022-04-01"。月日として読めない値は null。
export function dateFromEntry(mmdd: string, year: number): string | null {
  if (!/^\d{4}$/.test(mmdd)) return null;
  const month = mmdd.slice(0, 2);
  const day = mmdd.slice(2, 4);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

export class ArticleDateBackfillWorkflow extends WorkflowEntrypoint<
  Env,
  BackfillParams
> {
  async run(event: WorkflowEvent<BackfillParams>, step: WorkflowStep) {
    const { includeUnlisted = false, batchSize = 50 } = event.payload ?? {};
    const runId = Date.now();
    const db = drizzle(this.env.DB);

    console.log(
      `[Backfill] START runId=${runId} includeUnlisted=${includeUnlisted}`,
    );

    // date が未設定の article を対象にする。何度流しても既に入った分は触らない。
    const targets = await step.do(`fetch-targets-${runId}`, async () => {
      const rows = await db
        .select({
          articleId: articles.id,
          pageId: pages.id,
          title: pages.title,
          bodyKey: pages.bodyKey,
          created: pages.created,
        })
        .from(articles)
        .innerJoin(pages, eq(pages.id, articles.pageID))
        .where(isNull(articles.date));

      if (includeUnlisted) return rows;

      const listed = await db
        .select({ targetPageID: onThisDayEntries.targetPageID })
        .from(onThisDayEntries);
      const listedIds = new Set(listed.map((r) => r.targetPageID));
      return rows.filter((r) => listedIds.has(r.pageId));
    });

    console.log(`[Backfill] targets=${targets.length}`);
    if (targets.length === 0) return { resolved: 0, unresolved: 0 };

    // on_this_day_entry のフォールバック用。(targetPageID -> "YYYY-MM-DD")
    const fallback = await step.do(`fetch-fallback-${runId}`, async () => {
      const rows = await db
        .select({
          targetPageID: onThisDayEntries.targetPageID,
          year: onThisDayEntries.year,
          mmdd: pages.title,
        })
        .from(onThisDayEntries)
        .innerJoin(pages, eq(pages.id, onThisDayEntries.pageID));

      const map: Record<number, string> = {};
      for (const r of rows) {
        const date = dateFromEntry(r.mmdd, r.year);
        // 同一記事が複数の MMDD ページに貼られている場合がある (6 件)。
        // 本文が正なのでここでは先勝ちで構わない。本文から決まればそちらが勝つ。
        if (date && map[r.targetPageID] === undefined) map[r.targetPageID] = date;
      }
      return map;
    });

    let resolved = 0;
    let unresolved = 0;
    const unresolvedTitles: string[] = [];

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);

      const result = await step.do(`batch-${i}-${runId}`, async () => {
        let ok = 0;
        let ng = 0;
        const ngTitles: string[] = [];

        for (const t of batch) {
          const body = await fetchBody(this.env.R2, t.bodyKey, t.title);
          // 規則 1〜6 を先に通し、決まらなければ on_this_day_entry を使う。
          const date =
            resolveArticleDate({
              body,
              title: t.title,
              bodyKey: t.bodyKey,
              created: t.created,
            }) ?? fallback[t.pageId] ?? null;

          if (!date) {
            ng++;
            ngTitles.push(t.title);
            continue;
          }

          await db
            .update(articles)
            .set({ date })
            .where(eq(articles.id, t.articleId));
          ok++;
        }

        return { ok, ng, ngTitles };
      });

      resolved += result.ok;
      unresolved += result.ng;
      unresolvedTitles.push(...result.ngTitles);
    }

    console.log(
      `[Backfill] FINISH runId=${runId} resolved=${resolved} unresolved=${unresolved}`,
    );
    if (unresolvedTitles.length > 0) {
      console.log(`[Backfill] unresolved: ${unresolvedTitles.join(" / ")}`);
    }

    return { resolved, unresolved, unresolvedTitles };
  }
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // cron からの自動起動はしない。バックフィルは手動で trigger する。
  },
};
