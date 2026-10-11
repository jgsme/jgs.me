import type { PageContextServer } from "vike/types";
import { render } from "vike/abort";
import { useConfig } from "vike-react/useConfig";
import { eq } from "drizzle-orm";
import { pages, zets } from "@jigsaw/db";
import { zetDisplayTitle } from "@jigsaw/db/zet";
import { fetchBody } from "@jigsaw/db/fetch-body";
import type { Bindings } from "@/server/types";
import { getDB } from "@/db/getDB";
import { buildArticleBody } from "@/pages/article/@title/articleBody";

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context) => {
  const config = useConfig();
  const rkey = c.routeParams.rkey;
  const db = getDB(c.env.DB);

  const [row] = await db
    .select({
      pageId: pages.id,
      title: pages.title,
      bodyKey: pages.bodyKey,
      zetTitle: zets.title,
      date: zets.date,
    })
    .from(zets)
    .innerJoin(pages, eq(zets.pageID, pages.id))
    .where(eq(zets.rkey, rkey))
    .limit(1);
  if (!row) throw render(404);

  const body = await fetchBody(c.env.R2, row.bodyKey, row.title);
  if (body === null) throw render(404);

  // 先頭の題の行 (zet:<rkey>) を落とす。記事と同じ関数を通す。
  const built = buildArticleBody(body);
  const heading = zetDisplayTitle({ title: row.zetTitle, date: row.date });

  config({
    title: `${heading} - I am Electrical machine`,
    description: built.description,
  });

  return {
    rkey,
    pageId: row.pageId,
    heading,
    // 題がある zet だけ h1 を p-name にする。日付だけの見出しは題ではない。
    hasTitle: row.zetTitle !== null && row.zetTitle.trim() !== "",
    date: row.date,
    blocks: built.blocks,
    description: built.description,
  };
};

export default data;
