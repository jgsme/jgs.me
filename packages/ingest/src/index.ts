import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { articles, pages, similarityRuns } from "@jigsaw/db";
import { isAuthorized } from "./auth";
import { chunk, parseRows } from "./rows";

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
      let body: { model?: unknown; params?: unknown };
      try {
        body = (await request.json()) as { model?: unknown; params?: unknown };
      } catch {
        return new Response("invalid json", { status: 400 });
      }
      if (typeof body.model !== "string" || body.model === "") {
        return new Response("model is required", { status: 400 });
      }
      const [row] = await db
        .insert(similarityRuns)
        .values({ model: body.model, params: JSON.stringify(body.params ?? {}) })
        .returning({ id: similarityRuns.id });
      return Response.json({ runID: row!.id });
    }

    // 1 statement あたりのバインド上限に収めるため 16 行 (16 × 5 列 = 80 パラメータ) ずつに割る。
    // batch は 1 回の D1 呼び出しかつトランザクション。
    // INSERT OR REPLACE なので同じリクエストを二度投げても壊れない (Windmill のリトライ対策)。
    const rowsMatch = url.pathname.match(/^\/similarity\/runs\/(\d+)\/rows$/);
    if (request.method === "POST" && rowsMatch) {
      const runID = Number(rowsMatch[1]);
      let rows;
      try {
        rows = parseRows(await request.json());
      } catch (e) {
        return new Response(String(e instanceof Error ? e.message : e), { status: 400 });
      }
      if (rows.length === 0) return Response.json({ inserted: 0 });

      const stmts = chunk(rows, 16).map((group) =>
        env.DB.prepare(
          `INSERT OR REPLACE INTO page_similarity (runID, pageID, relatedPageID, score, adjusted) VALUES ${group
            .map(() => "(?,?,?,?,?)")
            .join(",")}`,
        ).bind(
          ...group.flatMap((r) => [runID, r.pageID, r.relatedPageID, r.score, r.adjusted]),
        ),
      );
      await env.DB.batch(stmts);
      return Response.json({ inserted: rows.length });
    }

    // 表示の切り替え。ここまでは誰も新しい run を見ていないので、
    // この 1 batch が唯一の「切り替わる瞬間」になる (欠損ウィンドウがない)。
    const activateMatch = url.pathname.match(/^\/similarity\/runs\/(\d+)\/activate$/);
    if (request.method === "POST" && activateMatch) {
      const runID = Number(activateMatch[1]);

      const exists = await env.DB.prepare(
        "SELECT 1 FROM similarity_run WHERE id = ?",
      )
        .bind(runID)
        .first();
      if (!exists) return new Response("run not found", { status: 404 });

      await env.DB.batch([
        env.DB.prepare("UPDATE similarity_run SET current = 0 WHERE current = 1"),
        env.DB.prepare("UPDATE similarity_run SET current = 1 WHERE id = ?").bind(runID),
      ]);

      // 世代の刈り取り。表示中の run は必ず最新側に残る…とは限らない
      // (orphan な新しい run がある状態で古い run を activate する経路がある) ので、
      // 今 activate した run を明示的に除外する。
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM page_similarity WHERE runID <> ? AND runID NOT IN (SELECT id FROM similarity_run ORDER BY id DESC LIMIT 2)",
        ).bind(runID),
        env.DB.prepare(
          "DELETE FROM similarity_run WHERE id <> ? AND id NOT IN (SELECT id FROM similarity_run ORDER BY id DESC LIMIT 2)",
        ).bind(runID),
      ]);

      return Response.json({ activated: runID, pruned: true });
    }

    return notFound();
  },
};
