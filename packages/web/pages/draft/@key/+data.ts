import type { PageContextServer } from "vike/types";
import { render } from "vike/abort";
import { eq } from "drizzle-orm";
import { drafts } from "@jigsaw/db";
import { isDraftKey } from "@jigsaw/db/draft";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { getDB } from "@/db/getDB";
import { fetchOEmbeds } from "@/server/oembed";
import type { Bindings } from "@/server/types";
import { buildArticleBody } from "../../article/@title/articleBody";
import { collectOEmbedUrls } from "../../article/@title/components/embed";
import { loadXhtmParts } from "../../article/@title/xhtmParts";
import { applyDraftHeaders } from "./draftHeaders";

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context) => {
  // +headersResponse は +data より先に解決されるので、ここで書く。
  // 先頭で付けるのは、404 の応答にも同じヘッダを載せるため。
  applyDraftHeaders(c.headersResponse);

  // 形の崩れた鍵は D1 を引かない。
  const key = c.routeParams.key;
  if (!isDraftKey(key)) throw render(404);

  const db = getDB(c.env.DB);
  const [row] = await db
    .select({
      title: drafts.title,
      bodyKey: drafts.bodyKey,
      spoiler: drafts.spoiler,
    })
    .from(drafts)
    .where(eq(drafts.key, key))
    .limit(1);
  if (row === undefined) throw render(404);

  const body = await fetchBody(c.env.R2, row.bodyKey, row.title);
  if (body === null) throw render(404);

  const { blocks } = buildArticleBody(body);
  const [embeds, xhtm] = await Promise.all([
    fetchOEmbeds(collectOEmbedUrls(blocks)),
    loadXhtmParts(c.env.MEDIA, blocks),
  ]);

  // config({ title, description }) は呼ばない。+title.ts の固定の題だけを出し、
  // OG の題・説明に下書きの中身を載せない。
  return { title: row.title, blocks, embeds, xhtm, spoiler: row.spoiler };
};

export default data;
