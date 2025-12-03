import { Hono } from "hono";
import { pages, articles, excludedPages, clips } from "@jigsaw/db";
import { verifyToken } from "@jigsaw/db/token";
import { getDB } from "@/db/getDB";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types";

const api = new Hono<{ Bindings: Bindings }>();

api.get("/article/register", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.text("Missing token", 400);
  }

  const pageId = await verifyToken(token, c.env.REGISTER_SECRET);
  if (pageId === null) {
    return c.text("Invalid token", 403);
  }

  const db = getDB(c.env.DB);

  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });
  if (!page) {
    return c.text("Page not found", 404);
  }

  const existing = await db.query.articles.findFirst({
    where: eq(articles.pageID, pageId),
  });
  if (existing) {
    return c.redirect(`/pages/${encodeURIComponent(page.title)}`);
  }

  await db.insert(articles).values({ pageID: pageId });

  return c.redirect(`/pages/${encodeURIComponent(page.title)}`);
});

api.get("/article/exclude", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.text("Missing token", 400);
  }

  const pageId = await verifyToken(token, c.env.REGISTER_SECRET);
  if (pageId === null) {
    return c.text("Invalid token", 403);
  }

  const db = getDB(c.env.DB);

  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });
  if (!page) {
    return c.text("Page not found", 404);
  }

  const existing = await db.query.excludedPages.findFirst({
    where: eq(excludedPages.pageID, pageId),
  });
  if (existing) {
    return c.text(`Already excluded: ${page.title}`, 200);
  }

  await db.insert(excludedPages).values({ pageID: pageId });

  return c.text(`Excluded: ${page.title}`, 200);
});

api.get("/article/clip", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.text("Missing token", 400);
  }

  const pageId = await verifyToken(token, c.env.REGISTER_SECRET);
  if (pageId === null) {
    return c.text("Invalid token", 403);
  }

  const db = getDB(c.env.DB);

  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });
  if (!page) {
    return c.text("Page not found", 404);
  }

  const existing = await db.query.clips.findFirst({
    where: eq(clips.pageID, pageId),
  });
  if (existing) {
    return c.text(`Already clipped: ${page.title}`, 200);
  }

  await db.insert(clips).values({ pageID: pageId });

  return c.text(`Clipped: ${page.title}`, 200);
});

export { api };
