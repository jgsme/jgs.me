import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
import { pages, onThisDayEntries } from "@jigsaw/db";
import { parse, type Node } from "@progfay/scrapbox-parser";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
  WORKFLOW: Workflow;
};

type OnThisDayParams = {
  cutoff?: number; // Unix timestamp
  fullScan?: boolean;
  start?: string; // MMDD
  end?: string; // MMDD
};

type PageData = {
  lines: { text: string }[];
};

type EntryToInsert = typeof onThisDayEntries.$inferInsert;

type TempEntry = {
  pageID: number;
  year: number;
  tempTitle: string;
};

export class OnThisDayWorkflow extends WorkflowEntrypoint<
  Env,
  OnThisDayParams
> {
  async run(event: WorkflowEvent<OnThisDayParams>, step: WorkflowStep) {
    const { cutoff: payloadCutoff, fullScan, start, end } = event.payload ?? {};
    let cutoff = payloadCutoff;

    if (fullScan || start || end) {
      cutoff = 0;
    } else if (cutoff === undefined) {
      cutoff = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    }

    const runId = Date.now();

    console.log(
      `[OnThisDay] START: runId=${runId}, cutoff=${cutoff}, fullScan=${fullScan}, start=${start}, end=${end}`,
    );

    const db = drizzle(this.env.DB);

    const targetPages = await step.do(`fetch-pages-${runId}`, async () => {
      const candidates = await db
        .select({
          id: pages.id,
          title: pages.title,
          sbID: pages.sbID,
          updated: pages.updated,
        })
        .from(pages)
        .orderBy(pages.title);

      const cutoffDate = new Date(cutoff * 1000);
      console.log(
        `[OnThisDay] Filter cutoffDate: ${cutoffDate.toISOString()} (timestamp: ${cutoff})`,
      );

      const parseDate = (dateStr: string): Date => {
        if (/^\d+$/.test(dateStr)) {
          return new Date(parseInt(dateStr, 10) * 1000);
        }
        if (dateStr.includes("T")) return new Date(dateStr);
        return new Date(dateStr.replace(" ", "T") + "Z");
      };

      return candidates.filter((p) => {
        const titleStr = String(p.title);
        if (!/^\d{4}$/.test(titleStr)) return false;

        if (start && titleStr < start) return false;
        if (end && titleStr > end) return false;

        const updatedDate = parseDate(p.updated);
        const keep = updatedDate >= cutoffDate;

        if (keep) {
          console.log(
            `[OnThisDay] Hit: ${p.title} (raw: ${
              p.updated
            }, parsed: ${updatedDate.toISOString()}) >= cutoff: ${cutoffDate.toISOString()}`,
          );
        }

        return keep;
      });
    });

    if (targetPages.length === 0) return { count: 0 };

    let processedCount = 0;
    const batchSize = 10;
    for (let i = 0; i < targetPages.length; i += batchSize) {
      const batch = targetPages.slice(i, i + batchSize);

      await step.do(`batch-${i}-${runId}`, async () => {
        for (const page of batch) {
          const obj = await this.env.R2.get(`${page.sbID}.json`);
          if (!obj) continue;

          const data = await obj.json<PageData>();
          const text = data.lines.map((l) => l.text).join("\n");
          const blocks = parse(text);

          const tempEntries: TempEntry[] = [];
          let currentYear: number | null = null;

          for (const block of blocks) {
            if (block.type !== "line") continue;

            const flattenNodes = (nodes: readonly Node[]): string => {
              return nodes
                .map((n) => {
                  if ("nodes" in n) return flattenNodes(n.nodes);
                  if ("raw" in n) return n.raw;
                  return "";
                })
                .join("");
            };

            const lineText = flattenNodes(block.nodes).trim();

            if (lineText.startsWith("[") && lineText.endsWith("]")) {
              const inner = lineText.slice(1, -1);
              if (/^\d{4}$/.test(inner)) {
                currentYear = parseInt(inner, 10);
                continue;
              }
            }

            if (currentYear) {
              const collectLinks = (nodes: readonly Node[]) => {
                for (const node of nodes) {
                  if (node.type === "link" && node.pathType === "relative") {
                    if (!/^\d{4}$/.test(node.href)) {
                      tempEntries.push({
                        pageID: page.id,
                        year: currentYear!,
                        tempTitle: node.href,
                      });
                    }
                  } else if ("nodes" in node) {
                    collectLinks(node.nodes);
                  }
                }
              };
              collectLinks(block.nodes);
            }
          }

          if (tempEntries.length > 0) {
            const titles = Array.from(
              new Set(tempEntries.map((e) => e.tempTitle)),
            );
            const foundPages = await db
              .select({ id: pages.id, title: pages.title })
              .from(pages)
              .where(inArray(pages.title, titles));

            const titleMap = new Map(foundPages.map((p) => [p.title, p.id]));
            const validEntries: EntryToInsert[] = tempEntries
              .map((e) => {
                const targetPageID = titleMap.get(e.tempTitle);
                if (targetPageID === undefined) return null;
                return {
                  pageID: e.pageID,
                  targetPageID,
                  year: e.year,
                };
              })
              .filter((e): e is EntryToInsert => e !== null);

            if (validEntries.length > 0) {
              const dbTx = drizzle(this.env.DB);
              await dbTx.batch([
                dbTx
                  .delete(onThisDayEntries)
                  .where(eq(onThisDayEntries.pageID, page.id)),
                dbTx.insert(onThisDayEntries).values(validEntries),
              ]);
            }
          }
        }
      });
      processedCount += batch.length;
    }

    return { processedCount };
  }
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await env.WORKFLOW.create();
  },
};
