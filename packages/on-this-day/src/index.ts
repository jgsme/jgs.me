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

// on_this_day_entry の行から targetPageID -> "YYYY-MM-DD" のフォールバック表を組み立てる。
// 手書きの entry が一つの日付に定まる記事だけを表に載せる。同一記事が複数の
// 異なる MMDD ページに貼られている場合 (6 件) は手書きだけでは決められないので、
// map には入れず本文解決 (resolveArticleDate) に委ねる。同じ日付が重複しているだけなら
// 曖昧ではないので載せる。
export function buildFallbackMap(
  rows: { targetPageID: number; year: number; mmdd: string }[],
): Record<number, string> {
  const seen: Record<number, Set<string>> = {};
  for (const r of rows) {
    const date = dateFromEntry(r.mmdd, r.year);
    if (!date) continue;
    (seen[r.targetPageID] ??= new Set()).add(date);
  }

  const map: Record<number, string> = {};
  for (const [id, dates] of Object.entries(seen)) {
    if (dates.size === 1) map[Number(id)] = [...dates][0];
  }
  return map;
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
    const targets = await step.do("fetch-targets", async () => {
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

    // 手書きの on_this_day_entry を正とする。(targetPageID -> "YYYY-MM-DD")
    const fallback = await step.do("fetch-fallback", async () => {
      const rows = await db
        .select({
          targetPageID: onThisDayEntries.targetPageID,
          year: onThisDayEntries.year,
          mmdd: pages.title,
        })
        .from(onThisDayEntries)
        .innerJoin(pages, eq(pages.id, onThisDayEntries.pageID));

      return buildFallbackMap(rows);
    });

    let resolved = 0;
    let unresolved = 0;
    const unresolvedTitles: string[] = [];

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);

      const result = await step.do(`batch-${i}`, async () => {
        let ok = 0;
        let ng = 0;
        const ngTitles: string[] = [];

        for (const t of batch) {
          // 手書きの on_this_day_entry を先に使い、無ければ本文から規則 1〜6 で決める。
          // entry が決まっているときは R2 から本文を読む必要すらない。
          const fromEntry = fallback[t.pageId];
          const date =
            fromEntry ??
            resolveArticleDate({
              body: await fetchBody(this.env.R2, t.bodyKey, t.title),
              title: t.title,
              bodyKey: t.bodyKey,
              created: t.created,
            }) ??
            null;

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
