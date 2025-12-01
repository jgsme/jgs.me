import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

type Env = {
  R2: R2Bucket;
  SYNC_WORKFLOW: Workflow;
  SYNC_BATCH_WORKFLOW: Workflow;
};

type ScrapboxListResponse = {
  count: number;
  pages: {
    id: string;
    title: string;
    image: string | null;
    created: number;
    updated: number;
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

const SCRAPBOX_PROJECT = "jigsaw";

async function fetchPageListChunk(
  skip: number,
  limit: number
): Promise<{ pages: ScrapboxListResponse["pages"]; total: number }> {
  const res = await fetch(
    `https://scrapbox.io/api/pages/${SCRAPBOX_PROJECT}?skip=${skip}&limit=${limit}`
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

export class SyncWorkflow extends WorkflowEntrypoint<Env, unknown> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const { total } = await step.do("get-page-count", async () => {
      const result = await fetchPageListChunk(0, 1);
      return { total: result.total };
    });

    const listChunkSize = 1000;
    let allPages: PageInfo[] = [];

    for (let skip = 0; skip < total; skip += listChunkSize) {
      const chunk = await step.do(`fetch-page-list-${skip}`, async () => {
        const result = await fetchPageListChunk(skip, listChunkSize);
        return result.pages.map((p) => ({
          id: p.id,
          title: p.title,
          updated: p.updated,
        }));
      });
      allPages = allPages.concat(chunk);
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

    return {
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
