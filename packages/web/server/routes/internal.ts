import { Hono } from "hono";
import { isAuthorized } from "../auth";
import { cacheKeyFor } from "../cacheKey";
import { SITE_URL } from "@/constants/site";
import type { Bindings } from "../types";

const internal = new Hono<{ Bindings: Bindings }>();

// 1 リクエストで無制限にループさせない。改題を伴う更新でも
// 新旧 /pages/*, /a/<n>, /p/<n> の 4 本で足りる。
const MAX_PATHS = 100;

export function parsePurgePaths(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("paths must be an array");
  if (input.length === 0) throw new Error("paths must not be empty");
  if (input.length > MAX_PATHS) {
    throw new Error(`paths must not exceed ${MAX_PATHS} entries`);
  }

  return input.map((path) => {
    if (typeof path !== "string") throw new Error("path must be a string");
    // "//evil.example/x" は new URL(path, SITE_URL) で別ホストに解決される。
    // "\" を "/" として扱う実装もあるため、まとめて弾く。
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error(`path must be site-relative: ${path}`);
    }
    if (path.includes("\\")) {
      throw new Error(`path must not contain a backslash: ${path}`);
    }
    return path;
  });
}

// w.jgs.me は公開ドメインなので、このパスも外から到達する。
// service binding 経由かどうかでは守れない。共有シークレットで弾く。
internal.post("/internal/purge", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? null, c.env.PURGE_TOKEN)) {
    return c.text("unauthorized", 401);
  }

  let body: { paths?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  let paths: string[];
  try {
    paths = parsePurgePaths(body.paths);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }

  // caches.default の delete は Worker が動いたデータセンターにしか効かない。
  // 他の colo に残った HTML は s-maxage が切れるまで古いまま。
  // 全 colo に効かせるならここを zone の purge API に差し替える
  // (キャッシュキーに __v が入るので、その組み立てはこの関数のまま使える)。
  const cache = caches.default;
  const version = c.env.CF_VERSION_METADATA.id;

  let deleted = 0;
  for (const path of paths) {
    const key = new Request(
      cacheKeyFor(new URL(path, SITE_URL).toString(), version),
      {
        method: "GET",
      },
    );
    if (await cache.delete(key)) deleted++;
  }

  console.log(`[purge] paths=${paths.length} deleted=${deleted}`);
  return c.json({ requested: paths.length, deleted });
});

export { internal };
