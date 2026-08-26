import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { articles, pages, similarityRuns } from "@jigsaw/db";
import { isAuthorized } from "./auth";
import { chunk, parseRows } from "./rows";
import {
  handleMicropubConfig,
  handleMicropubMedia,
  handleMicropubPost,
  handleMicropubSource,
} from "./micropub";
import { handleGyazoMigrate } from "./gyazoMigrate";

export interface Env {
  DB: D1Database;
  SIMILARITY_TOKEN: string;
  MICROPUB_TOKEN: string;
  // 記事本文。Scrapbox アーカイブと同じバケット。
  R2: R2Bucket;
  // Micropub media endpoint の画像。
  MEDIA: R2Bucket;
  MEDIA_BASE_URL: string;
  AP: Fetcher;
  // 記事ページのエッジキャッシュを消す口 (web の POST /internal/purge)。
  WEB: Fetcher;
  PURGE_TOKEN: string;
}

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

function notFound(): Response {
  return new Response("not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Micropub は similarity とは別のトークンで認証する (ハンドラ内でチェックする)。
    if (url.pathname === "/micropub") {
      if (request.method === "POST") return handleMicropubPost(request, env);
      if (request.method === "GET" && url.searchParams.get("q") === "config") {
        return handleMicropubConfig(request, env);
      }
      if (request.method === "GET" && url.searchParams.get("q") === "source") {
        return handleMicropubSource(request, env);
      }
    }
    if (url.pathname === "/micropub/media" && request.method === "POST") {
      return handleMicropubMedia(request, env);
    }

    // ここから下は similarity 用。共有シークレットで一括認証する。
    if (
      !isAuthorized(request.headers.get("Authorization"), env.SIMILARITY_TOKEN)
    ) {
      return unauthorized();
    }

    const db = drizzle(env.DB);

    // Gyazo → R2 の移行バッチ。フェーズは body の phase で切り替える。
    if (
      request.method === "POST" &&
      url.pathname === "/internal/gyazo-migrate"
    ) {
      return handleGyazoMigrate(request, env);
    }

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
        .values({
          model: body.model,
          params: JSON.stringify(body.params ?? {}),
        })
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
        return new Response(String(e instanceof Error ? e.message : e), {
          status: 400,
        });
      }
      if (rows.length === 0) return Response.json({ inserted: 0 });

      const stmts = chunk(rows, 16).map((group) =>
        env.DB.prepare(
          `INSERT OR REPLACE INTO page_similarity (runID, pageID, relatedPageID, score, adjusted) VALUES ${group
            .map(() => "(?,?,?,?,?)")
            .join(",")}`,
        ).bind(
          ...group.flatMap((r) => [
            runID,
            r.pageID,
            r.relatedPageID,
            r.score,
            r.adjusted,
          ]),
        ),
      );
      await env.DB.batch(stmts);
      return Response.json({ inserted: rows.length });
    }

    // 表示の切り替え。ここまでは誰も新しい run を見ていないので、
    // この 1 batch が唯一の「切り替わる瞬間」になる (欠損ウィンドウがない)。
    const activateMatch = url.pathname.match(
      /^\/similarity\/runs\/(\d+)\/activate$/,
    );
    if (request.method === "POST" && activateMatch) {
      const runID = Number(activateMatch[1]);

      const exists = await env.DB.prepare(
        "SELECT 1 FROM similarity_run WHERE id = ?",
      )
        .bind(runID)
        .first();
      if (!exists) return new Response("run not found", { status: 404 });

      const rowCount = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM page_similarity WHERE runID = ?",
      )
        .bind(runID)
        .first<{ n: number }>();
      // 空の世代を current にすると全記事の関連欄が消え、24h キャッシュに焼き付く。
      // 不変条件はここで守る (呼び出し側の実装に依存させない)。
      if (!rowCount || rowCount.n === 0) {
        return new Response("run has no rows", { status: 409 });
      }

      // 切り戻し先として直前の current を残す。id 順で残すと、activate されずに
      // 放置された orphan run が正常な直前世代を押し出してしまう。
      const prev = await env.DB.prepare(
        "SELECT id FROM similarity_run WHERE current = 1",
      ).first<{ id: number }>();
      const keep = prev && prev.id !== runID ? [runID, prev.id] : [runID];

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE similarity_run SET current = 0 WHERE current = 1",
        ),
        env.DB.prepare(
          "UPDATE similarity_run SET current = 1 WHERE id = ?",
        ).bind(runID),
      ]);

      // 世代の刈り取り。keep = [今 activate した run, 直前まで current だった run]。
      // id 順で残すと、activate されずに放置された orphan run が
      // 正常な直前世代を押し出してしまうため、id 順ではなく keep で明示する。
      const ph = keep.map(() => "?").join(",");
      await env.DB.batch([
        env.DB.prepare(
          `DELETE FROM page_similarity WHERE runID NOT IN (${ph})`,
        ).bind(...keep),
        env.DB.prepare(
          `DELETE FROM similarity_run WHERE id NOT IN (${ph})`,
        ).bind(...keep),
      ]);

      return Response.json({ activated: runID, pruned: true });
    }

    return notFound();
  },
};
