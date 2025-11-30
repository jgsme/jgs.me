type Env = {
  R2: R2Bucket;
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

const SCRAPBOX_PROJECT = "jigsaw";

async function fetchPageList(): Promise<ScrapboxListResponse["pages"]> {
  let pages: ScrapboxListResponse["pages"] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `https://scrapbox.io/api/pages/${SCRAPBOX_PROJECT}?skip=${skip}&limit=${limit}`
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch page list: ${res.status}`);
    }

    const json = (await res.json()) as ScrapboxListResponse;
    pages = pages.concat(json.pages);

    console.log(
      `Fetched page list: skip=${skip}, total=${pages.length}/${json.count}`
    );

    if (skip + limit >= json.count) {
      break;
    }
    skip += limit;
  }

  return pages;
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

async function syncFromScrapbox(
  env: Env
): Promise<{ synced: number; skipped: number }> {
  const pages = await fetchPageList();

  let synced = 0;
  let skipped = 0;

  for (const page of pages) {
    const key = `${page.id}.json`;

    const existing = await env.R2.head(key);
    if (existing?.customMetadata?.updated) {
      const existingUpdated = parseInt(existing.customMetadata.updated, 10);
      if (existingUpdated >= page.updated) {
        skipped++;
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

    await env.R2.put(key, JSON.stringify(data), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { updated: String(page.updated) },
    });

    synced++;
    console.log(`Synced: ${key} (${page.title})`);
  }

  return { synced, skipped };
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      syncFromScrapbox(env).then((result) => {
        console.log(
          `Sync completed: ${result.synced} synced, ${result.skipped} skipped`
        );
      })
    );
  },

  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("w-sync worker", { status: 200 });
  },
};
