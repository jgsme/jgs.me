import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { articles, pages, similarityRuns } from "@jigsaw/db";
import { isAuthorized } from "./auth";

export interface Env {
  DB: D1Database;
  SIMILARITY_TOKEN: string;
}

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

function notFound(): Response {
  return new Response("not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request.headers.get("Authorization"), env.SIMILARITY_TOKEN)) {
      return unauthorized();
    }

    const url = new URL(request.url);
    const db = drizzle(env.DB);

    // 類似度計算の対象。article として公開しているページだけを返す。
    if (request.method === "GET" && url.pathname === "/similarity/targets") {
      const rows = await db
        .select({ id: pages.id, title: pages.title })
        .from(articles)
        .innerJoin(pages, eq(pages.id, articles.pageID));
      return Response.json({ targets: rows });
    }

    // 新しい計算世代を作る。current = false なので、この時点では表示に影響しない。
    if (request.method === "POST" && url.pathname === "/similarity/runs") {
      const body = (await request.json()) as { model?: unknown; params?: unknown };
      if (typeof body.model !== "string" || body.model === "") {
        return new Response("model is required", { status: 400 });
      }
      const [row] = await db
        .insert(similarityRuns)
        .values({ model: body.model, params: JSON.stringify(body.params ?? {}) })
        .returning({ id: similarityRuns.id });
      return Response.json({ runID: row!.id });
    }

    return notFound();
  },
};
