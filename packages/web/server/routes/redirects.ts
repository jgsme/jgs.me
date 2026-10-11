import { Hono } from "hono";
import { pages, articles, clips, zets } from "@jigsaw/db";
import { zetPath } from "@jigsaw/db/zet";
import { getDB } from "@/db/getDB";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types";

const redirects = new Hono<{ Bindings: Bindings }>();

redirects.get("/a/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.redirect("/");
  }

  const db = getDB(c.env.DB);
  const result = await db
    .select({ title: pages.title })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .where(eq(articles.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].title) {
    return c.redirect("/");
  }

  return c.redirect(`/pages/${encodeURIComponent(result[0].title)}`);
});

redirects.get("/p/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.redirect("/");
  }

  const db = getDB(c.env.DB);
  const result = await db
    .select({ title: pages.title, zetRkey: zets.rkey })
    .from(pages)
    .leftJoin(zets, eq(zets.pageID, pages.id))
    .where(eq(pages.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].title) {
    return c.redirect("/");
  }

  // zet の page.title は内部用 (zet:<rkey>)。人が読む URL は /zets/<rkey>。
  if (result[0].zetRkey) {
    return c.redirect(zetPath(result[0].zetRkey));
  }

  return c.redirect(`/pages/${encodeURIComponent(result[0].title)}`);
});

// clip の permalink。/a/:id (article) と同型で、行き先は同じ /pages/<title>。
// clip 単体を指す安定した URL が無いと、外部から個々の clip を参照できない。
redirects.get("/c/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.redirect("/");
  }

  const db = getDB(c.env.DB);
  const result = await db
    .select({ title: pages.title })
    .from(clips)
    .innerJoin(pages, eq(clips.pageID, pages.id))
    .where(eq(clips.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].title) {
    return c.redirect("/");
  }

  return c.redirect(`/pages/${encodeURIComponent(result[0].title)}`);
});

export { redirects };
