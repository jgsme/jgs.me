import { Hono } from "hono";
import type { Env } from "../db";
import { buildWebfinger } from "../actor";

const webfinger = new Hono<{ Bindings: Env }>();

webfinger.get("/.well-known/webfinger", (c) => {
  const resource = c.req.query("resource");
  if (!resource) return c.text("resource is required", 400);
  const doc = buildWebfinger(resource);
  if (!doc) return c.notFound();
  return c.json(doc, 200, { "Content-Type": "application/jrd+json" });
});

export { webfinger };
