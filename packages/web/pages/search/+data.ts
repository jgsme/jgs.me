import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { pages } from "@jigsaw/db";
import { inArray } from "drizzle-orm";
import {
  bodyKeyFromFilename,
  dedupeByBodyKey,
  snippetFromMd,
} from "@/utils/searchResults";

type Context = PageContextServer & {
  env: Bindings;
};

type SearchResult = {
  title: string;
  snippet: string;
  score: number;
};

const MAX_NUM_RESULTS = 20;

const data = async (c: Context) => {
  const query = c.urlParsed.search.q;

  if (!query) {
    return {
      ok: true,
      payload: {
        query: "",
        results: [] as SearchResult[],
      },
    };
  }

  const response = await c.env.AI.autorag("w-rag").search({
    query,
    max_num_results: MAX_NUM_RESULTS,
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
    return { ok: true, payload: { query, results: [] as SearchResult[] } };
  }

  const rows = await getDB(c.env.DB)
    .select({ bodyKey: pages.bodyKey, title: pages.title })
    .from(pages)
    .where(
      inArray(
        pages.bodyKey,
        hits.map((h) => h.bodyKey),
      ),
    );
  const titleOf = new Map(rows.map((r) => [r.bodyKey, r.title]));

  // 題が引けないのは page が消えたのに md が残っている場合。出しても
  // リンク先が無いので落とす。
  const results: SearchResult[] = hits.flatMap((hit) => {
    const title = titleOf.get(hit.bodyKey);
    if (title === undefined) return [];
    return [{ title, snippet: hit.snippet, score: hit.score }];
  });

  return {
    ok: true,
    payload: {
      query,
      results,
    },
  };
};

export default data;
