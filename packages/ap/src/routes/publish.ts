import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { articles, followers, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, objectURI } from "../config";
import { resolveContent } from "../content";
import { toArticle } from "../as2";
import { wrapCreate, wrapDelete, wrapUpdate } from "../activities";
import { decideFanout } from "../fanout";

const publish = new Hono<{ Bindings: Env }>();

// Service Binding からのみ到達する内部エンドポイント。
// web の proxy 対象に /internal/* を含めないこと。
publish.post("/internal/publish", async (c) => {
  const body = (await c.req.json()) as { pageID?: unknown; kind?: unknown };
  const pageID = Number(body.pageID);
  const kind = body.kind;
  if (!Number.isInteger(pageID) || pageID <= 0) {
    return c.json({ error: "pageID is required" }, 400);
  }
  if (kind !== "create" && kind !== "update" && kind !== "delete") {
    return c.json({ error: "kind must be create|update|delete" }, 400);
  }

  const db = getDB(c.env.DB);

  const targets = await db
    .select({
      id: followers.id,
      inbox: followers.inbox,
      sharedInbox: followers.sharedInbox,
    })
    .from(followers)
    .where(eq(followers.state, "accepted"));

  if (targets.length === 0) {
    console.log(`[publish] no followers pageID=${pageID} kind=${kind}`);
    return c.json({ queued: 0 });
  }

  let activity: unknown;

  if (kind === "delete") {
    activity = wrapDelete(objectURI(pageID));
  } else {
    const rows = await db
      .select({
        id: pages.id,
        title: pages.title,
        created: pages.created,
        updated: pages.updated,
        bodyKey: pages.bodyKey,
      })
      .from(pages)
      .innerJoin(articles, eq(articles.pageID, pages.id))
      .where(eq(pages.id, pageID))
      .limit(1);

    const page = rows[0];
    if (!page) return c.json({ error: "page not found or not published" }, 404);

    const decision = decideFanout(page.created, new Date());
    if (!decision.deliver) {
      // 配信しなかったことは必ず残す。silent に落とさない。
      console.log(
        `[publish] skipped pageID=${pageID} kind=${kind} reason=${decision.reason} created=${page.created}`,
      );
      return c.json({ queued: 0, skipped: decision.reason });
    }

    const content = await resolveContent(
      page.bodyKey,
      c.env.R2,
      SITE_URL,
      page.title,
    );
    const article = toArticle(page, content);
    activity = kind === "create" ? wrapCreate(article) : wrapUpdate(article);
  }

  // sharedInbox があればそちらに寄せて重複配送を減らす。
  const inboxes = [...new Set(targets.map((t) => t.sharedInbox ?? t.inbox))];

  await c.env.DELIVERY.sendBatch(
    inboxes.map((inbox) => ({ body: { inbox, activity } })),
  );

  console.log(
    `[publish] queued pageID=${pageID} kind=${kind} inboxes=${inboxes.length}`,
  );
  return c.json({ queued: inboxes.length });
});

export { publish };
