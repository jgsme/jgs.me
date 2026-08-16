import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { articles, pages } from "@jigsaw/db";
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

    return notFound();
  },
};
