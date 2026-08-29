import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server/types";
import { clips, pages } from "@jigsaw/db";
import { getDB } from "@/db/getDB";
import { count, desc, eq } from "drizzle-orm";
import { parse } from "@progfay/scrapbox-parser";
import { fetchBody } from "@/utils/fetchBody";
import { firstLinkHostname } from "@/utils/firstLinkHostname";
import { buildArticleBody } from "@/pages/article/@title/articleBody";

type Context = PageContextServer & {
  env: Bindings;
};

const PER_PAGE = 20;
// 一覧に出す抜粋の長さ。カード 1 枚に 2 行程度で収まる量。
const SNIPPET_MAX = 100;

const data = async (c: Context) => {
  const db = getDB(c.env.DB);
  const page = Number(c.urlParsed.search.p) || 1;
  const offset = (page - 1) * PER_PAGE;

  const [cs, totalResult] = await Promise.all([
    db
      .select({
        id: clips.id,
        title: pages.title,
        image: pages.image,
        bodyKey: pages.bodyKey,
      })
      .from(clips)
      .innerJoin(pages, eq(clips.pageID, pages.id))
      .orderBy(desc(pages.created))
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: count() }).from(clips),
  ]);

  // 画像を持たない clip が増えたので、本文の冒頭と元記事のドメインを
  // 添えて一覧が読めるようにする。R2 は 1 ページ 20 件ぶん引く
  // (/rss.xml も同じ件数を同じやり方で引いている)。
  const enriched = await Promise.all(
    cs.map(async (clip) => {
      const body = await fetchBody(c.env.R2, clip.bodyKey, clip.title);
      if (body === null) {
        return {
          id: clip.id,
          title: clip.title,
          image: clip.image,
          description: null,
          hostname: null,
        };
      }
      // built.blocks は from 行 (from [YYYYMMDD]) と日付ハッシュタグ行
      // (#YYYYMMDD) を落とす。Scrapbox アーカイブ由来の clip はこの2つを
      // 高頻度で持つため、built.blocks から探すとリンクごと消えて
      // hostname が null になるケースがある。リンク抽出には生の
      // parse(body) を使う (二重パースのコストは、同じリクエストで走る
      // 20 回の R2 GET の前では無視できる)。
      const built = buildArticleBody(body);
      return {
        id: clip.id,
        title: clip.title,
        image: clip.image,
        description: built.description.slice(0, SNIPPET_MAX) || null,
        hostname: firstLinkHostname(parse(body)),
      };
    }),
  );

  const total = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return {
    ok: true,
    payload: {
      clips: enriched,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default data;
