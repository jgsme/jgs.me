// spike: 旧 AutoRAG instance と AI Search 新 instance を同じ語で比べる。
// main には入れない。
import { Hono } from "hono";
import { isAuthorized } from "../auth";
import type { Bindings } from "../types";
import { bodyKeyFromFilename } from "@/utils/searchResults";

const OLD = "w-rag-md-512";
const NEW = "w-md-hybrid";

const DEFAULT_QUERIES = [
  "F1",
  "沖縄",
  "映画",
  "猫",
  "プリキュア",
  "学マス",
  "TypeScript",
  "Home Assistant",
  "JavaScript デバッグ",
  "テネット 感想",
  "モデル3 の乗り心地",
  "ネタバレ",
];

// ai_search_namespaces binding を足すと Workers Builds の preview が落ちたので、
// 既存の AI binding 経由で namespace を取る (deprecated)。
const ns = (env: Bindings) => env.AI.aiSearch();

const searchSpike = new Hono<{ Bindings: Bindings }>();

searchSpike.use("/internal/search-spike/*", async (c, next) => {
  if (!isAuthorized(c.req.header("Authorization") ?? null, c.env.PURGE_TOKEN)) {
    return c.text("unauthorized", 401);
  }
  await next();
});

searchSpike.get("/internal/search-spike/info", async (c) => {
  const list = await ns(c.env).list();
  const detail = async (id: string) => {
    const inst = ns(c.env).get(id);
    try {
      return { info: await inst.info(), stats: await inst.stats() };
    } catch (e) {
      return { error: String(e) };
    }
  };
  return c.json({
    instances: list.result.map((i) => i.id),
    [OLD]: await detail(OLD),
    [NEW]: await detail(NEW),
  });
});

searchSpike.post("/internal/search-spike/setup", async (c) => {
  const old = await ns(c.env).get(OLD).info();
  const inst = await ns(c.env).create({
    id: NEW,
    type: "r2",
    source: "w-md",
    token_id: old.token_id,
    embedding_model: old.embedding_model,
    chunk_size: old.chunk_size,
    chunk_overlap: old.chunk_overlap,
    index_method: { vector: true, keyword: true },
    fusion_method: "rrf",
    indexing_options: { keyword_tokenizer: "trigram" },
    rewrite_query: false,
    reranking: false,
    cache: true,
    cache_threshold: "super_strict_match",
    custom_metadata: [
      { field_name: "is_article", data_type: "boolean" },
      { field_name: "is_clip", data_type: "boolean" },
    ],
  });
  return c.json({ created: await inst.info() });
});

type Hit = { key: string; score: number };
type Run = { ms: number[]; hits: Hit[]; error?: string };

async function timed(fn: () => Promise<Hit[]>, runs: number): Promise<Run> {
  const ms: number[] = [];
  let hits: Hit[] = [];
  for (let i = 0; i < runs; i++) {
    const t = Date.now();
    try {
      hits = await fn();
    } catch (e) {
      return { ms, hits, error: String(e) };
    }
    ms.push(Date.now() - t);
  }
  return { ms, hits };
}

function uniqTop(hits: Hit[], n: number): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const h of hits) {
    if (seen.has(h.key)) continue;
    seen.add(h.key);
    out.push({ key: h.key, score: Math.round(h.score * 1000) / 1000 });
    if (out.length === n) break;
  }
  return out;
}

searchSpike.get("/internal/search-spike/bench", async (c) => {
  const qs = c.req.queries("q");
  const queries = qs && qs.length > 0 ? qs : DEFAULT_QUERIES;
  const runs = Math.min(Number(c.req.query("runs") ?? "2"), 5);
  const top = 10;
  const max = 20;

  const legacy = (query: string) => async () => {
    const r = await c.env.AI.autorag(OLD).search({
      query,
      max_num_results: max,
    });
    return r.data.map((d) => ({ key: d.filename, score: d.score }));
  };
  const modern =
    (id: string, query: string, type?: "vector" | "keyword" | "hybrid") =>
    async () => {
      const r = await ns(c.env)
        .get(id)
        .search({
          query,
          ai_search_options: {
            retrieval: { retrieval_type: type, max_num_results: max },
            query_rewrite: { enabled: false },
            reranking: { enabled: false },
          },
        });
      return r.chunks.map((ch) => ({ key: ch.item.key, score: ch.score }));
    };

  const results = [];
  for (const query of queries) {
    const variants = {
      oldAutorag: await timed(legacy(query), runs),
      oldBinding: await timed(modern(OLD, query), runs),
      newHybrid: await timed(modern(NEW, query, "hybrid"), runs),
      newVector: await timed(modern(NEW, query, "vector"), runs),
      newKeyword: await timed(modern(NEW, query, "keyword"), runs),
    };
    results.push({
      query,
      ...Object.fromEntries(
        Object.entries(variants).map(([k, v]) => [
          k,
          {
            ms: v.ms,
            error: v.error,
            top: uniqTop(v.hits, top).map(
              (h) => `${bodyKeyFromFilename(h.key) ?? h.key} ${h.score}`,
            ),
          },
        ]),
      ),
    });
  }
  return c.json({ runs, colo: c.req.raw.cf?.colo, results });
});

export { searchSpike };
