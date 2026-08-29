import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, clips, objects, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, articleURL, objectURI } from "../config";
import { toArticle, toNote } from "../as2";
import { resolveContent } from "../content";

export const AS2_CONTENT_TYPE = "application/activity+json";

// ActivityPub の id は dereferenceable でなければならず、
// Accept: application/activity+json で AS2 を返す必要がある。
// ブラウザからのアクセスは人間向けの URL に逃がす。
export function wantsActivityJson(accept: string | null): boolean {
  if (!accept) return false;
  return (
    accept.includes("application/activity+json") ||
    accept.includes("application/ld+json")
  );
}

const objectRoute = new Hono<{ Bindings: Env }>();

objectRoute.get("/o/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.notFound();

  const db = getDB(c.env.DB);

  // article だけでなく clip も配送対象。innerJoin(articles) のままだと
  // clip しか持たない page の canonical URI (id) が 404 を返してしまう
  // (publish.ts が Note として配送しているのに、ここで引けない)。
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      created: pages.created,
      updated: pages.updated,
      bodyKey: pages.bodyKey,
      articleID: articles.id,
      clipID: clips.id,
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .leftJoin(clips, eq(clips.pageID, pages.id))
    .where(eq(pages.id, id))
    .limit(1);

  const page = rows[0];
  // article にも clip にも行が無い = 未公開。federation の対象外。
  if (!page || (page.articleID === null && page.clipID === null)) {
    return c.notFound();
  }

  const deletedRows = await db
    .select({ deleted: objects.deleted })
    .from(objects)
    .where(and(eq(objects.id, objectURI(id)), eq(objects.deleted, true)))
    .limit(1);

  if (deletedRows.length > 0) {
    // Tombstone を body で返す場合は 410 を返す (ActivityPub 仕様の SHOULD)。
    return c.json(
      {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: objectURI(id),
        type: "Tombstone",
      },
      410,
      { "Content-Type": AS2_CONTENT_TYPE },
    );
  }

  if (!wantsActivityJson(c.req.header("Accept") ?? null)) {
    return c.redirect(articleURL(page.title), 302);
  }

  const contentHtml = await resolveContent(
    page.bodyKey,
    c.env.R2,
    SITE_URL,
    page.title,
  );

  // 配送した型と提供する型を揃える。publish.ts の分岐と同じ条件
  // (article 行が無い = clip としてだけ公開されている page)。
  const object =
    page.articleID === null
      ? toNote(page, contentHtml)
      : toArticle(page, contentHtml);

  return c.json(object, 200, {
    "Content-Type": AS2_CONTENT_TYPE,
  });
});

export { objectRoute };
