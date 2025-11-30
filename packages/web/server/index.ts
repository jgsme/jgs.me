import { Hono } from "hono";
import { apply, serve } from "@photonjs/hono";
import { pages, articles } from "@/db/schema";
import { getDB } from "@/db/getDB";
import { eq } from "drizzle-orm";

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/api/page/create", async (c) => {
  const json = await c.req.json();
  if (json) {
    const db = getDB(c.env.DB);
    const res = await db.insert(pages).values(json);
    if (res.success) {
      return c.json({ ok: true, payload: { id: res.results[0] } });
    }
  }
  return c.json({ ok: false });
});

app.post("/api/article/create", async (c) => {
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
});

apply(app);
export default serve(app);
