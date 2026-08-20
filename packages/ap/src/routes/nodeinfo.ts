import { Hono } from "hono";
import type { Env } from "../db";
import { SITE_URL } from "../config";

const nodeinfo = new Hono<{ Bindings: Env }>();

// NodeInfo は ActivityPub 仕様の外だが、多くの実装が
// サーバの種類を判定するために参照する。
nodeinfo.get("/.well-known/nodeinfo", (c) =>
  c.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `${SITE_URL}/nodeinfo/2.1`,
      },
    ],
  }),
);

nodeinfo.get("/nodeinfo/2.1", (c) =>
  c.json({
    version: "2.1",
    software: { name: "jgs-me", version: "0.1.0" },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations: false,
    usage: { users: { total: 1 } },
    metadata: {},
  }),
);

export { nodeinfo };
