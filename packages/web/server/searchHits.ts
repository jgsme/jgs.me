import {
  AUTORAG_MAX_NUM_RESULTS,
  bodyKeyFromFilename,
  snippetFromMd,
} from "@/utils/searchResults";

// AutoRAG の 1 chunk ぶん。bodyKey が null なのは w-md 以外のキーに当たった
// chunk。種別ごとに先頭何 chunk を使うかを変えるので、ここでは落とさず
// 順位を保ったまま持つ。
export type SearchChunk = {
  bodyKey: string | null;
  score: number;
  snippet: string;
};

type AutoRagItem = {
  filename: string;
  score: number;
  content: Array<{ text: string }>;
};

export type AutoRagSearch = (req: {
  query: string;
  max_num_results: number;
}) => Promise<{ data: AutoRagItem[] }>;

// 検索で一番重いのは AutoRAG。絞り込みの切り替えや同じ語の再検索で叩き直さない
// よう、種別に依らない結果を語ごとに caches.default に置く。インデックスの更新は
// 数分から数時間遅れて反映されるものなので、1 時間古くても困らない。
export const SEARCH_HITS_TTL = 3600;

// 置く中身の形を変えたら上げる。古い形のエントリは TTL で落ちる。
const KEY_VERSION = "1";

export function searchHitsCacheKey(origin: string, query: string): string {
  const u = new URL("/__cache/search-hits", origin);
  u.searchParams.set("v", KEY_VERSION);
  u.searchParams.set("q", query);
  return u.toString();
}

export function chunksFromAutoRag(
  items: readonly AutoRagItem[],
): SearchChunk[] {
  return items.map((item) => ({
    bodyKey: bodyKeyFromFilename(item.filename),
    score: item.score,
    snippet: snippetFromMd(item.content[0]?.text ?? ""),
  }));
}

const cacheAvailable = (origin: string) => {
  if (typeof caches === "undefined") return false;
  const { hostname } = new URL(origin);
  return hostname !== "localhost" && hostname !== "127.0.0.1";
};

export async function searchChunks(
  query: string,
  opts: {
    origin: string;
    search: AutoRagSearch;
    waitUntil?: (p: Promise<unknown>) => void;
  },
): Promise<{ chunks: SearchChunk[]; cached: boolean }> {
  const useCache = cacheAvailable(opts.origin);
  const key = new Request(searchHitsCacheKey(opts.origin, query));

  if (useCache) {
    const hit = await caches.default.match(key);
    if (hit) return { chunks: await hit.json(), cached: true };
  }

  const response = await opts.search({
    query,
    max_num_results: AUTORAG_MAX_NUM_RESULTS,
  });
  const chunks = chunksFromAutoRag(response.data);

  if (useCache) {
    const put = caches.default.put(
      key,
      new Response(JSON.stringify(chunks), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `s-maxage=${SEARCH_HITS_TTL}`,
        },
      }),
    );
    if (opts.waitUntil) opts.waitUntil(put);
    else await put;
  }

  return { chunks, cached: false };
}
