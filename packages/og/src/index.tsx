import { Hono } from "hono";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { getDB } from "./db";
import { pages } from "@jigsaw/db";
import { eq } from "drizzle-orm";
import {
  generateDefaultOgImage,
  generateImageWithTitleOgImage,
  generateTitleOgImage,
} from "./image";
import { initWasm } from "@resvg/resvg-wasm";
// @ts-expect-error wasm import
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  OG: R2Bucket;
  ENVIRONMENT: string;
};

type RegenerateParams = {
  pageId: number;
};

const app = new Hono<{ Bindings: Bindings }>();

let wasmInitialized = false;
app.use("*", async (c, next) => {
  if (!wasmInitialized) {
    await initWasm(resvgWasm);
    wasmInitialized = true;
  }
  await next();
});

app.get("/default.png", async (c) => {
  const isDev = c.env.ENVIRONMENT === "development";

  if (!isDev) {
    const cached = await c.env.OG.get("default.png");
    if (cached) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const png = await generateDefaultOgImage();

  if (!isDev) {
    await c.env.OG.put("default.png", png, {
      httpMetadata: { contentType: "image/png" },
    });
  }

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": isDev
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    },
  });
});

app.get("/p/:filename", async (c) => {
  const isDev = c.env.ENVIRONMENT === "development";
  const filename = c.req.param("filename");
  if (!filename || !filename.endsWith(".png")) {
    return c.notFound();
  }
  const idStr = filename.replace(".png", "");
  const pageId = parseInt(idStr, 10);
  if (isNaN(pageId)) {
    return c.notFound();
  }

  const cacheKey = `p/${pageId}.png`;

  if (!isDev) {
    const cached = await c.env.OG.get(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  const db = getDB(c.env.DB);
  const page = await db
    .select({ title: pages.title, image: pages.image })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (page.length === 0) {
    return c.notFound();
  }

  const { title, image } = page[0];

  let png: Uint8Array;

  if (image) {
    png = await generateImageWithTitleOgImage(title, image);
  } else {
    png = await generateTitleOgImage(title);
  }

  if (!isDev) {
    await c.env.OG.put(cacheKey, png, {
      httpMetadata: { contentType: "image/png" },
    });
  }

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": isDev ? "no-cache" : "public, max-age=86400",
    },
  });
});

export class RegenerateWorkflow extends WorkflowEntrypoint<
  Bindings,
  RegenerateParams
> {
  async run(event: WorkflowEvent<RegenerateParams>, step: WorkflowStep) {
    const { pageId } = event.payload;

    const cacheKey = `p/${pageId}.png`;
    await step.do("delete-cache", async () => {
      await this.env.OG.delete(cacheKey);
    });

    const pageInfo = await step.do("fetch-page-info", async () => {
      const db = getDB(this.env.DB);
      const page = await db
        .select({ title: pages.title, image: pages.image })
        .from(pages)
        .where(eq(pages.id, pageId))
        .limit(1);

      if (page.length === 0) {
        throw new Error(`Page not found: ${pageId}`);
      }
      return page[0];
    });

    await step.do("regenerate-og", async () => {
      const { title, image } = pageInfo;

      let png: Uint8Array;
      if (image) {
        png = await generateImageWithTitleOgImage(title, image);
      } else {
        png = await generateTitleOgImage(title);
      }

      await this.env.OG.put(cacheKey, png, {
        httpMetadata: { contentType: "image/png" },
      });
    });

    return { pageId, cacheKey, regenerated: true };
  }
}

export default app;
