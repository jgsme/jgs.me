import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { pages, onThisDayEntries } from "@jigsaw/db";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
};

export class OnThisDayIndexWorkflow extends WorkflowEntrypoint<Env, {}> {
  async run(event: WorkflowEvent<{}>, step: WorkflowStep) {
    const runId = Date.now();
    console.log(`[OnThisDayIndex] START: runId=${runId}`);

    const db = drizzle(this.env.DB);

    const counts = await step.do(`generate-index-${runId}`, async () => {
      const allEntries = await db
        .select({
          year: onThisDayEntries.year,
          mmdd: pages.title,
        })
        .from(onThisDayEntries)
        .innerJoin(pages, eq(onThisDayEntries.pageID, pages.id));

      const yearSet = new Set<number>();
      const tempIndex: Record<string, Record<number, number>> = {};

      for (const entry of allEntries) {
        yearSet.add(entry.year);
        if (!tempIndex[entry.mmdd]) {
          tempIndex[entry.mmdd] = {};
        }
        const yearCounts = tempIndex[entry.mmdd];
        yearCounts[entry.year] = (yearCounts[entry.year] || 0) + 1;
      }

      const years = Array.from(yearSet).sort((a, b) => a - b);
      const yearMap = new Map(years.map((y, i) => [y, i]));

      const entries: Record<string, [number, number][]> = {};
      for (const [mmdd, counts] of Object.entries(tempIndex)) {
        entries[mmdd] = Object.entries(counts).map(([year, count]) => [
          yearMap.get(parseInt(year, 10))!,
          count,
        ]);
        // Sort by year index for consistency
        entries[mmdd].sort((a, b) => a[0] - b[0]);
      }

      const result = {
        years,
        entries,
      };

      await this.env.R2.put("on-this-day-index.json", JSON.stringify(result));

      return {
        dayCount: Object.keys(entries).length,
        entryCount: allEntries.length,
      };
    });

    console.log(`[OnThisDayIndex] FINISH: runId=${runId}, dayCount=${counts.dayCount}, entryCount=${counts.entryCount}`);
    return counts;
  }
}
