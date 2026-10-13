import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { pages } from "@jigsaw/db";
import { inArray, sql } from "drizzle-orm";
import {
  chunksFor,
  dedupeByBodyKey,
  matchesSearchType,
  parseSearchType,
} from "@/utils/searchResults";
import { searchChunks } from "@/server/searchHits";

type Context = PageContextServer & {
  env: Bindings;
  ctx?: ExecutionContext;
};

type SearchResult = {
  title: string;
  snippet: string;
  score: number;
};

const data = async (c: Context) => {
  const query = c.urlParsed.search.q;
  const type = parseSearchType(c.urlParsed.search.type);

  if (!query) {
    return {
      ok: true,
      payload: {
        query: "",
        type,
        results: [] as SearchResult[],
      },
    };
  }

  const startedAt = Date.now();
  const { chunks, cached } = await searchChunks(query, {
    origin: new URL(c.urlOriginal).origin,
    search: (req) => c.env.AI.autorag("w-rag-md-512").search(req),
    waitUntil: c.ctx ? (p) => c.ctx?.waitUntil(p) : undefined,
  });
  const searchedAt = Date.now();

  // filename は R2 のキー。w-md のキーは <bodyKey>.md なので、そこから
  // page を引ける。chunk の中身から題を取ると、題が入っている先頭 chunk に
  // 当たらなかったページが結果から落ちる。
  const hits = dedupeByBodyKey(
    chunks
      .slice(0, chunksFor(type))
      .flatMap(({ bodyKey, score, snippet }) =>
        bodyKey === null ? [] : [{ bodyKey, score, snippet }],
      ),
  );

  if (hits.length === 0) {
    return {
      ok: true,
      payload: { query, type, results: [] as SearchResult[] },
    };
  }

  const rows = await getDB(c.env.DB)
    .select({
      bodyKey: pages.bodyKey,
      title: pages.title,
      // article と clip の両方に登録されているページがあるので join ではなく
      // exists で引く。join だと行が増える。列を ${} で埋めると select 句では
      // 修飾されず、サブクエリ内の "id" が article.id に化けるので直書きする。
      isArticle: sql<number>`exists (select 1 from "article" where "article"."pageID" = "page"."id")`,
      isClip: sql<number>`exists (select 1 from "clip" where "clip"."pageID" = "page"."id")`,
    })
    .from(pages)
    .where(
      inArray(
        pages.bodyKey,
        hits.map((h) => h.bodyKey),
      ),
    );
  const rowOf = new Map(rows.map((r) => [r.bodyKey, r]));
  // どこが遅いかを Workers Logs で見るため。検索語は残さない。
  console.log(
    JSON.stringify({
      msg: "search timing",
      type,
      cached,
      autoragMs: searchedAt - startedAt,
      d1Ms: Date.now() - searchedAt,
      chunks: chunks.length,
    }),
  );

  // 題が引けないのは page が消えたのに md が残っている場合。出しても
  // リンク先が無いので落とす。
  const results: SearchResult[] = hits.flatMap((hit) => {
    const row = rowOf.get(hit.bodyKey);
    if (row === undefined) return [];
    const kinds = { isArticle: row.isArticle === 1, isClip: row.isClip === 1 };
    if (!matchesSearchType(kinds, type)) return [];
    return [{ title: row.title, snippet: hit.snippet, score: hit.score }];
  });

  return {
    ok: true,
    payload: {
      query,
      type,
      results,
    },
  };
};

export default data;
