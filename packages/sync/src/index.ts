import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { pages as pagesTable } from "@jigsaw/db";
export { OnThisDayWorkflow } from "./on-this-day";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
  SYNC_WORKFLOW: Workflow;
  SYNC_BATCH_WORKFLOW: Workflow;
  ON_THIS_DAY_WORKFLOW: Workflow;
};

type ScrapboxListResponse = {
  count: number;
  pages: {
    id: string;
    title: string;
    image: string | null;
    created: number;
    updated: number;
    pin: number;
  }[];
};

type ScrapboxPageResponse = {
  id: string;
  title: string;
  image: string | null;
  created: number;
  updated: number;
  lines: {
    id: string;
    text: string;
    created: number;
    updated: number;
  }[];
};

type PageInfo = {
  id: string;
  title: string;
  updated: number;
};

type SyncBatchParams = {
  pages: PageInfo[];
  batchIndex: number;
};

type SyncParams = {
  cutoff?: number; // Unix timestamp (seconds). Only sync pages updated after this time.
};

const SCRAPBOX_PROJECT = "jigsaw";

async function fetchPageListChunk(
  skip: number,
  limit: number
): Promise<{ pages: ScrapboxListResponse["pages"]; total: number }> {
  const res = await fetch(
    `https://scrapbox.io/api/pages/${SCRAPBOX_PROJECT}?skip=${skip}&limit=${limit}&sort=updated`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch page list: ${res.status}`);
  }

  const json = (await res.json()) as ScrapboxListResponse;
  return { pages: json.pages, total: json.count };
}

async function fetchPageDetail(title: string): Promise<ScrapboxPageResponse> {
  const res = await fetch(
    `https://scrapbox.io/api/pages/${SCRAPBOX_PROJECT}/${encodeURIComponent(
      title
    )}`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch page ${title}: ${res.status}`);
  }

  return res.json() as Promise<ScrapboxPageResponse>;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const defaultCutoff = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const { cutoff = defaultCutoff } = event.payload ?? {};

    const listChunkSize = 1000;
    let allPages: PageInfo[] = [];
    let skip = 0;
    let reachedCutoff = false;

    while (!reachedCutoff) {
      const result = await step.do(`fetch-page-list-${skip}`, async () => {
        const chunk = await fetchPageListChunk(skip, listChunkSize);
        const pages: (PageInfo & { pin: number })[] = [];
        let foundOldPage = false;

        for (const p of chunk.pages) {
          if (p.pin > 0 || p.updated >= cutoff) {
            pages.push({
              id: p.id,
              title: p.title,
              updated: p.updated,
              pin: p.pin,
            });
          } else {
            foundOldPage = true;
            break;
          }
        }

        return {
          pages,
          foundOldPage,
          chunkSize: chunk.pages.length,
          total: chunk.total,
        };
      });

      allPages = allPages.concat(result.pages.map(({ pin, ...rest }) => rest));

      if (result.foundOldPage || result.chunkSize < listChunkSize) {
        reachedCutoff = true;
      } else {
        skip += listChunkSize;
      }
    }

    const batchSize = 300;
    const batchCount = Math.ceil(allPages.length / batchSize);
    const instanceIds: string[] = [];

    for (let i = 0; i < batchCount; i++) {
      const batchPages = allPages.slice(i * batchSize, (i + 1) * batchSize);

      const instanceId = await step.do(`start-batch-${i}`, async () => {
        const instance = await this.env.SYNC_BATCH_WORKFLOW.create({
          params: {
            pages: batchPages,
            batchIndex: i,
          } satisfies SyncBatchParams,
        });
        return instance.id;
      });

      instanceIds.push(instanceId);
    }

    // Trigger On This Day workflow
    // It runs independently, checking for updated pages.
    await step.do("trigger-on-this-day", async () => {
      await this.env.ON_THIS_DAY_WORKFLOW.create({
        params: {
          cutoff,
        },
      });
    });

    return {
      cutoff,
      total: allPages.length,
      batchCount,
      instanceIds,
    };
  }
}

export class SyncBatchWorkflow extends WorkflowEntrypoint<
  Env,
  SyncBatchParams
> {
  async run(event: WorkflowEvent<SyncBatchParams>, step: WorkflowStep) {
    const { pages, batchIndex } = event.payload;

    let synced = 0;
    let skipped = 0;

    const syncBatchSize = 100;
    for (let i = 0; i < pages.length; i += syncBatchSize) {
      const batch = pages.slice(i, i + syncBatchSize);

      const results = await step.do(
        `batch-${batchIndex}-sync-${i}`,
        async () => {
          const batchResults = { synced: 0, skipped: 0 };

          for (const page of batch) {
            const key = `${page.id}.json`;

            const existing = await this.env.R2.head(key);
            if (existing?.customMetadata?.updated) {
              const existingUpdated = parseInt(
                existing.customMetadata.updated,
                10
              );
              if (existingUpdated >= page.updated) {
                batchResults.skipped++;
                continue;
              }
            }

            const detail = await fetchPageDetail(page.title);

            const data = {
              id: detail.id,
              title: detail.title,
              image: detail.image,
              created: detail.created,
              updated: detail.updated,
              lines: detail.lines.map((line) => ({
                id: line.id,
                text: line.text,
                created: line.created,
                updated: line.updated,
              })),
            };

            await this.env.R2.put(key, JSON.stringify(data), {
              httpMetadata: { contentType: "application/json" },
              customMetadata: { updated: String(page.updated) },
            });

            const db = drizzle(this.env.DB);
            const existingPage = await db
              .select()
              .from(pagesTable)
              .where(eq(pagesTable.sbID, detail.id))
              .get();

            if (existingPage) {
              await db
                .update(pagesTable)
                .set({
                  title: detail.title,
                  image: detail.image,
                  created: new Date(detail.created * 1000).toISOString(),
                  updated: new Date(detail.updated * 1000).toISOString(),
                })
                .where(eq(pagesTable.sbID, detail.id));
            } else {
              await db.insert(pagesTable).values({
                title: detail.title,
                image: detail.image,
                sbID: detail.id,
                created: new Date(detail.created * 1000).toISOString(),
                updated: new Date(detail.updated * 1000).toISOString(),
              });
            }

            batchResults.synced++;
          }

          return batchResults;
        }
      );

      synced += results.synced;
      skipped += results.skipped;
    }

    return { batchIndex, synced, skipped, total: pages.length };
  }
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    await env.SYNC_WORKFLOW.create();
  },

  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("w-sync worker", { status: 200 });
  },
};
