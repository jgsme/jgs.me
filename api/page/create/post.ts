import type { Context } from "hono";
import type { Bindings } from "@/hono-entry";
import { pages } from "@/db/schema";
import { getDB } from "@/db/getDB";

export const postPageCreate = async (c: Context<{ Bindings: Bindings }>) => {
  const json = await c.req.json();
  if (json) {
    const db = getDB(c.env.DB);
    const res = await db.insert(pages).values(json);
    if (res.success) {
      return c.json({ ok: true, payload: { id: res.results[0] } });
    }
  }
  return c.json({ ok: false });
};
