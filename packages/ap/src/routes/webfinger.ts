import { Hono } from "hono";
import type { Env } from "../db";
import { buildWebfinger } from "../actor";
import { SITE_URL } from "../config";

const webfinger = new Hono<{ Bindings: Env }>();

webfinger.get("/.well-known/webfinger", (c) => {
  const resource = c.req.query("resource");
  if (!resource) return c.text("resource is required", 400);
  const doc = buildWebfinger(resource);
  if (!doc) return c.notFound();
  return c.json(doc, 200, { "Content-Type": "application/jrd+json" });
});

// host-meta は WebFinger より古い発見手段。Mastodon 4.x は使わないが、
// 未実装のままだと web 側が 500 を返してしまう。lrdd テンプレートを
// 返して WebFinger に誘導する。
webfinger.get("/.well-known/host-meta", (c) =>
  c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n` +
      `  <Link rel="lrdd" template="${SITE_URL}/.well-known/webfinger?resource={uri}"/>\n` +
      `</XRD>\n`,
    200,
    { "Content-Type": "application/xrd+xml" },
  ),
);

export { webfinger };
