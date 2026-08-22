import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { articles, followers, pages } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { SITE_URL, articleURL, objectURI } from "../config";
import { resolveContent } from "../content";
import { toArticle, type PageRow } from "../as2";
import {
  wrapActorUpdate,
  wrapCreate,
  wrapDelete,
  wrapUpdate,
} from "../activities";
import { buildActor } from "../actor";
import { normalizePublicPem } from "../sig/keys";
import { decideFanout } from "../fanout";
import { extractOutlinks } from "../outlinks";

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

  // 本文と Webmention はフォロワーの有無・fan-out の可否と独立して扱う。
  // delete は本文が無いので対象外。
  let page: (PageRow & { bodyKey: string }) | null = null;
  let content = "";

  if (kind !== "delete") {
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

    page = rows[0] ?? null;
    if (!page) return c.json({ error: "page not found or not published" }, 404);

    content = await resolveContent(
      page.bodyKey,
      c.env.R2,
      SITE_URL,
      page.title,
    );

    // Webmention は fan-out の可否と独立して送る。
    // source は h-entry を持つ人間向けページ。/o/<n> ではない。
    // 受信側は source を fetch して mf2 を読むため、302 を返す URI を渡すと
    // リダイレクトを追わない実装に弾かれる。
    const outlinks = await extractOutlinks(content, SITE_URL);
    if (outlinks.length > 0) {
      const source = articleURL(page.title);
      await c.env.WM_SEND.sendBatch(
        outlinks.map((target) => ({ body: { source, target } })),
      );
      console.log(
        `[publish] webmentions queued=${outlinks.length} pageID=${pageID}`,
      );
    }
  }

  // 配信の可否は AP フォロワの有無と独立に決める。Bluesky への投稿は
  // フォロワーが 0 人でも行うため、followers を引く前に判定する。
  // delete は本文が無く 14 日の抑制も掛けないので対象外。
  if (kind !== "delete") {
    // kind !== "delete" なら上で必ず埋まっている (無ければ 404 を返している)。
    const decision = decideFanout(page!.created, new Date());
    if (!decision.deliver) {
      // 配信しなかったことは必ず残す。silent に落とさない。
      console.log(
        `[publish] skipped pageID=${pageID} kind=${kind} reason=${decision.reason} created=${page!.created}`,
      );
      return c.json({ queued: 0, skipped: decision.reason });
    }

    // Bluesky にも流す。14 日の抑制は ActivityPub と同じ理由で掛ける。
    // update を流さないのは、ATProto の更新がレコードの置き換えになり
    // copy.cid の管理が別途必要になるため。ここでは新規投稿だけを扱う。
    if (kind === "create") {
      await c.env.BSKY.send({ pageID });
      console.log(`[publish] bsky queued pageID=${pageID}`);
    }
  }

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
    const article = toArticle(page!, content);
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

// プロフィール (アイコン / ヘッダ / summary / attachment) を変えたときに
// フォロワーへ即時反映させる。相手は actor をキャッシュしていて、
// stale と判断するまで (おおむね1日) 再取得しない。
// /internal/publish に kind を足す形にしないのは、あちらが pageID 必須の
// 記事向けエンドポイントで引数の形が違うため。
publish.post("/internal/refresh-actor", async (c) => {
  const db = getDB(c.env.DB);

  const targets = await db
    .select({ inbox: followers.inbox, sharedInbox: followers.sharedInbox })
    .from(followers)
    .where(eq(followers.state, "accepted"));

  if (targets.length === 0) {
    console.log("[refresh-actor] no followers");
    return c.json({ queued: 0 });
  }

  const activity = wrapActorUpdate(
    buildActor(normalizePublicPem(c.env.AP_PUBLIC_KEY)),
    new Date().toISOString(),
  );

  const inboxes = [...new Set(targets.map((t) => t.sharedInbox ?? t.inbox))];

  await c.env.DELIVERY.sendBatch(
    inboxes.map((inbox) => ({ body: { inbox, activity } })),
  );

  console.log(`[refresh-actor] queued inboxes=${inboxes.length}`);
  return c.json({ queued: inboxes.length });
});

export { publish };
