import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { pages } from "@jigsaw/db";
import { inArray, sql } from "drizzle-orm";
import {
  bodyKeyFromFilename,
  dedupeByBodyKey,
  matchesSearchType,
  maxNumResultsFor,
  parseSearchType,
  snippetFromMd,
} from "@/utils/searchResults";

type Context = PageContextServer & {
  env: Bindings;
};

type SearchResult = {
  title: string;
  snippet: string;
  score: number;
  spoiler: boolean;
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

  const response = await c.env.AI.autorag("w-rag-md-512").search({
    query,
    max_num_results: maxNumResultsFor(type),
  });

  // filename は R2 のキー。w-md のキーは <bodyKey>.md なので、そこから
  // page を引ける。chunk の中身から題を取ると、題が入っている先頭 chunk に
  // 当たらなかったページが結果から落ちる。
  const hits = dedupeByBodyKey(
    response.data.flatMap((item) => {
      const bodyKey = bodyKeyFromFilename(item.filename);
      if (!bodyKey) return [];
      const content = item.content as Array<{ text: string }>;
      return [
        {
          bodyKey,
          score: item.score,
          snippet: snippetFromMd(content[0]?.text ?? ""),
        },
      ];
    }),
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
      spoiler: pages.spoiler,
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

  // 題が引けないのは page が消えたのに md が残っている場合。出しても
  // リンク先が無いので落とす。
  const results: SearchResult[] = hits.flatMap((hit) => {
    const row = rowOf.get(hit.bodyKey);
    if (row === undefined) return [];
    const kinds = { isArticle: row.isArticle === 1, isClip: row.isClip === 1 };
    if (!matchesSearchType(kinds, type)) return [];
    // 本文は検索に掛かるが、ネタバレの抜粋は見せない。
    return [
      {
        title: row.title,
        snippet: row.spoiler ? "" : hit.snippet,
        score: hit.score,
        spoiler: row.spoiler,
      },
    ];
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
