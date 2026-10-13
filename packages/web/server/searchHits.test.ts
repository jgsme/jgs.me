import { beforeEach, describe, expect, it } from "vitest";
import {
  searchChunks,
  searchHitsCacheKey,
  type AutoRagSearch,
} from "./searchHits";

function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    async match(req: Request) {
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req: Request, res: Response) {
      store.set(req.url, res);
    },
  };
}

const ORIGIN = "https://w.jgs.me";

function fakeSearch() {
  const calls: Parameters<AutoRagSearch>[0][] = [];
  const search: AutoRagSearch = async (req) => {
    calls.push(req);
    return {
      data: [
        { filename: "a.md", score: 0.9, content: [{ text: "# 題\n本文" }] },
        { filename: "other.json", score: 0.8, content: [] },
      ],
    };
  };
  return { search, calls };
}

describe("searchChunks", () => {
  let cache: ReturnType<typeof fakeCache>;

  beforeEach(() => {
    cache = fakeCache();
    (globalThis as { caches?: unknown }).caches = { default: cache };
  });

  it("種別に依らず上限まで引き、順位と w-md 以外の chunk を保つ", async () => {
    const { search, calls } = fakeSearch();
    const { chunks, cached } = await searchChunks("q", {
      origin: ORIGIN,
      search,
    });
    expect(cached).toBe(false);
    expect(calls).toEqual([{ query: "q", max_num_results: 50 }]);
    expect(chunks).toEqual([
      { bodyKey: "a", score: 0.9, snippet: "本文" },
      { bodyKey: null, score: 0.8, snippet: "" },
    ]);
  });

  it("同じ語の 2 回目は AutoRAG を叩かない", async () => {
    const { search, calls } = fakeSearch();
    const first = await searchChunks("q", { origin: ORIGIN, search });
    const second = await searchChunks("q", { origin: ORIGIN, search });
    expect(calls).toHaveLength(1);
    expect(second.cached).toBe(true);
    expect(second.chunks).toEqual(first.chunks);
  });

  it("語が違えば別キー", async () => {
    const { search, calls } = fakeSearch();
    await searchChunks("q", { origin: ORIGIN, search });
    await searchChunks("q2", { origin: ORIGIN, search });
    expect(calls).toHaveLength(2);
    expect(searchHitsCacheKey(ORIGIN, "a&b")).not.toBe(
      searchHitsCacheKey(ORIGIN, "a"),
    );
  });

  it("localhost では焼かない", async () => {
    const { search, calls } = fakeSearch();
    await searchChunks("q", { origin: "http://localhost:3000", search });
    await searchChunks("q", { origin: "http://localhost:3000", search });
    expect(calls).toHaveLength(2);
    expect(cache.store.size).toBe(0);
  });

  it("waitUntil があれば put をそこに積む", async () => {
    const { search } = fakeSearch();
    const pending: Promise<unknown>[] = [];
    await searchChunks("q", {
      origin: ORIGIN,
      search,
      waitUntil: (p) => pending.push(p),
    });
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(cache.store.size).toBe(1);
  });
});
