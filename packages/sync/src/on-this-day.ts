import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq, gt, inArray } from "drizzle-orm";
import { pages, onThisDayEntries } from "@jigsaw/db";
import { parse, type Node } from "@progfay/scrapbox-parser";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
};

type OnThisDayParams = {
  cutoff?: number; // Unix timestamp
  fullScan?: boolean;
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

export class OnThisDayWorkflow extends WorkflowEntrypoint<Env, OnThisDayParams> {
  async run(event: WorkflowEvent<OnThisDayParams>, step: WorkflowStep) {
    const { cutoff: payloadCutoff, fullScan } = event.payload ?? {};
    let cutoff = payloadCutoff;

    if (fullScan) {
      cutoff = 0;
    } else if (cutoff === undefined) {
      cutoff = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    }

    const runId = Date.now();

    console.log(`[OnThisDay] START: runId=${runId}, cutoff=${cutoff}, fullScan=${fullScan}`);

    const db = drizzle(this.env.DB);

    const targetPages = await step.do(`fetch-pages-${runId}`, async () => {
      const candidates = await db
        .select({
          id: pages.id,
          title: pages.title,
          sbID: pages.sbID,
          updated: pages.updated,
        })
        .from(pages);

      const cutoffDate = new Date(cutoff * 1000);
      return candidates.filter((p) => {
        const titleStr = String(p.title);
        if (!/^\d{4}$/.test(titleStr)) return false;
        const updatedDate = new Date(p.updated.replace(" ", "T") + "Z");
        return updatedDate >= cutoffDate;
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
              new Set(tempEntries.map((e) => e.tempTitle))
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
