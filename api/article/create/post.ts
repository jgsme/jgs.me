import type { Context } from "hono";
import type { Bindings } from "@/hono-entry";
import { pages, articles } from "@/db/schema";
import { getDB } from "@/db/getDB";
import { eq } from "drizzle-orm";

export const postArticleCreate = async (c: Context<{ Bindings: Bindings }>) => {
  const json = await c.req.json();
  if (json) {
    const db = getDB(c.env.DB);
    const page = await db.query.pages.findFirst({
      where: eq(pages.sbID, json.id),
    });
    if (page) {
      const res = await db.insert(articles).values({ pageID: page.id });
      if (res.success) {
        return c.json({ ok: true, payload: { id: res.results[0] } });
      }
    }
  }
  return c.json({ ok: false });
};
