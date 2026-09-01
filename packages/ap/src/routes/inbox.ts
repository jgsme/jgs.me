import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { articles, clips, followers, pages, reactions } from "@jigsaw/db";
import { getDB, type Env } from "../db";
import { sha256Digest, verifyDigest } from "../sig/digest";
import {
  cavageVerify,
  parseCavageHeader,
  type SignTarget,
} from "../sig/cavage";
import { rfc9421Verify } from "../sig/rfc9421";
import { fetchPublicKey, fetchRemoteActor } from "../remote";
import { importPrivateKey } from "../sig/keys";
import { deliver } from "../deliver";
import { ACTOR_URI } from "../actor";
import { SITE_URL } from "../config";
import {
  kindOf,
  pageIDFromObjectURI,
  reactionIDOf,
  sourceURLOf,
  targetURIOf,
} from "../reactions";
import { notifyDiscord } from "../notify";

const DEDUPE_TTL = 60 * 60 * 24; // 24h
// 相手の時計とのずれを許す幅。Mastodon も同程度の幅で判定している。
const MAX_CLOCK_SKEW_MS = 12 * 60 * 60 * 1000;

const inbox = new Hono<{ Bindings: Env }>();

function keyIdOf(req: Request): string | null {
  const cavage = req.headers.get("Signature");
  if (cavage && !cavage.startsWith("sig1=")) {
    return parseCavageHeader(cavage)?.keyId ?? null;
  }
  const input = req.headers.get("Signature-Input");
  return input?.match(/keyid="([^"]+)"/)?.[1] ?? null;
}

inbox.post("/ap/inbox", async (c) => {
  const req = c.req.raw;
  const body = await req.text();

  // 1. body の完全性。署名は Digest ヘッダを covered header に含むので、
  //    Digest 検証と署名検証が揃って初めて body が保証される。
  const digestHeader = req.headers.get("Digest");
  if (!(await verifyDigest(body, digestHeader))) {
    // body が届く途中で変質すると全ての検証が無意味になるので、
    // 落ちた事実だけでなく突き合わせた値も残す。body 自体は出さない
    // (DM が入りうる)。
    console.log(
      `[inbox] reject=digest header=${digestHeader} computed=${await sha256Digest(body)} len=${body.length}`,
    );
    return c.text("invalid digest", 401);
  }

  // 2. Date が極端にずれていたら弾く (リプレイ対策)。
  const date = req.headers.get("Date");
  if (!date) return c.text("date is required", 401);
  const skew = Math.abs(Date.now() - new Date(date).getTime());
  if (Number.isNaN(skew) || skew > MAX_CLOCK_SKEW_MS) {
    console.log(`[inbox] reject=date date=${date} skewMs=${skew}`);
    return c.text("date out of range", 401);
  }

  // 3. 相手の公開鍵を引く。
  const keyId = keyIdOf(req);
  if (!keyId) {
    console.log("[inbox] reject=no-key-id");
    return c.text("signature is required", 401);
  }
  const key = await fetchPublicKey(keyId, c.env.KV);
  if (!key) {
    console.log(`[inbox] reject=key-fetch keyId=${keyId}`);
    return c.text("cannot fetch public key", 401);
  }

  // 4. 署名検証。ここを通らないものは以降の処理に到達させない。
  const url = new URL(req.url);
  const target: SignTarget = {
    method: "POST",
    // 相手が署名したのは公開ホスト名に対してであり、
    // Service Binding 経由で来ても Host ヘッダは保たれる。
    url: `${url.protocol}//${req.headers.get("Host") ?? url.host}${url.pathname}${url.search}`,
    headers: {
      host: req.headers.get("Host") ?? url.host,
      date,
      digest: req.headers.get("Digest") ?? "",
      "content-type": req.headers.get("Content-Type") ?? "",
    },
  };

  const sigHeader = req.headers.get("Signature") ?? "";
  const sigInput = req.headers.get("Signature-Input");
  const verified = sigInput
    ? await rfc9421Verify(target, key, {
        "Signature-Input": sigInput,
        Signature: sigHeader,
      })
    : await cavageVerify(target, key, sigHeader);

  if (!verified) {
    console.log(
      `[inbox] reject=signature keyId=${keyId} variant=${sigInput ? "rfc9421" : "cavage"}`,
    );
    return c.text("invalid signature", 401);
  }

  // 5. 重複配送の排除。ネットワーク越しのリトライは普通に起きる。
  const activity = JSON.parse(body) as Record<string, any>;
  const activityID = typeof activity.id === "string" ? activity.id : null;
  if (activityID) {
    const seen = await c.env.KV.get(`seen:${activityID}`);
    if (seen) return c.text("", 202);
    await c.env.KV.put(`seen:${activityID}`, "1", {
      expirationTtl: DEDUPE_TTL,
    });
  }

  const db = getDB(c.env.DB);

  // 6. Follow → follower に入れて Accept を返す。
  if (activity.type === "Follow") {
    const actorURI =
      typeof activity.actor === "string" ? activity.actor : activity.actor?.id;
    if (typeof actorURI !== "string") return c.text("", 202);

    const remote = await fetchRemoteActor(actorURI, c.env.KV);
    if (!remote) {
      console.log(`[inbox] reject=actor-fetch actor=${actorURI}`);
      return c.text("cannot fetch actor", 400);
    }

    await db
      .insert(followers)
      .values({
        id: remote.id,
        protocol: "ap",
        inbox: remote.inbox,
        sharedInbox: remote.sharedInbox,
        state: "accepted",
        created: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: followers.id,
        set: {
          inbox: remote.inbox,
          sharedInbox: remote.sharedInbox,
          state: "accepted",
        },
      });

    const priv = await importPrivateKey(c.env.AP_PRIVATE_KEY);
    const accept = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${ACTOR_URI}/accept/${crypto.randomUUID()}`,
      type: "Accept",
      actor: ACTOR_URI,
      object: activity,
    };
    const result = await deliver(remote.inbox, accept, priv);
    console.log(
      `[accept] to=${remote.inbox} status=${result.status} variant=${result.variant}`,
    );
    return c.text("", 202);
  }

  // 7. Undo は Follow の取り消しと反応の取り消しの両方に使われる。
  if (activity.type === "Undo") {
    const inner = activity.object;
    const actorURI =
      typeof activity.actor === "string" ? activity.actor : activity.actor?.id;

    if (inner?.type === "Follow") {
      if (typeof actorURI === "string") {
        await db.delete(followers).where(eq(followers.id, actorURI));
      }
      return c.text("", 202);
    }

    // Like / EmojiReact / Announce の取り消し。
    // 行は消さず undone を立てる。履歴として残す。
    const innerID = typeof inner?.id === "string" ? inner.id : null;
    if (innerID) {
      await db
        .update(reactions)
        .set({ undone: true })
        .where(eq(reactions.id, innerID));
      console.log(`[inbox] undone reaction=${innerID}`);
    }
    return c.text("", 202);
  }

  // 8. Delete → 相手が投稿を消したら、それに対応する反応も消す。
  //    Undo と違い「最初から無かった」扱いなので行ごと消す。
  if (activity.type === "Delete") {
    const objID =
      typeof activity.object === "string"
        ? activity.object
        : typeof activity.object?.id === "string"
          ? activity.object.id
          : null;
    if (objID) {
      await db.delete(reactions).where(eq(reactions.id, objID));
      console.log(`[inbox] deleted reaction=${objID}`);
    }
    return c.text("", 202);
  }

  // 9. Like / EmojiReact / Announce / Create(inReplyTo) を反応として記録する。
  const kind = kindOf(activity);
  if (kind) {
    const targetURI = targetURIOf(activity);
    const pageID = targetURI ? pageIDFromObjectURI(targetURI, SITE_URL) : null;
    // 自サイトの記事を指していない反応は受け取らない。
    if (pageID === null) {
      console.log(`[inbox] reaction for unknown target=${targetURI}`);
      return c.text("", 202);
    }

    // reaction.targetPageID は page(id) への FK。存在しない id を insert すると
    // FK 違反で inbox が 500 を返し、相手がリトライを続ける。URI の形だけでは
    // 実在を保証できないので、公開済み (article か clip の行がある) かを
    // ここで確認する。article だけを見ると clip 宛の反応が全部落ちる
    // (canonical id は /o/<pageID> で article/clip 共通なので同様に見る)。
    const published = await db
      .select({ articleID: articles.id, clipID: clips.id })
      .from(pages)
      .leftJoin(articles, eq(articles.pageID, pages.id))
      .leftJoin(clips, eq(clips.pageID, pages.id))
      .where(eq(pages.id, pageID))
      .limit(1);
    // leftJoin だけだと page 単体行でも 1 件返ってしまうので、
    // article/clip どちらの id も無いケースを別途弾く。
    if (
      !published[0] ||
      (published[0].articleID === null && published[0].clipID === null)
    ) {
      console.log(`[inbox] reaction for unpublished page=${pageID}`);
      return c.text("", 202);
    }

    const reactionID = reactionIDOf(activity);
    if (!reactionID) return c.text("", 202);

    const actorURI =
      typeof activity.actor === "string" ? activity.actor : activity.actor?.id;
    const remote =
      typeof actorURI === "string"
        ? await fetchRemoteActor(actorURI, c.env.KV)
        : null;

    const content =
      kind === "reply" && typeof activity.object?.content === "string"
        ? activity.object.content
        : null;

    await db
      .insert(reactions)
      .values({
        id: reactionID,
        targetPageID: pageID,
        sourceProtocol: "ap",
        kind,
        emoji:
          kind === "emoji" && typeof activity.content === "string"
            ? activity.content
            : null,
        actorName: remote?.name ?? actorURI ?? null,
        actorURL: remote?.id ?? actorURI ?? null,
        actorIcon: remote?.icon ?? null,
        content,
        // 返信の主キーは Note の permalink。カードのリンク先に使うので
        // Webmention と同じ欄に移す。Like / Announce は開けないので null。
        sourceURL: sourceURLOf(kind, reactionID),
        created: new Date().toISOString(),
        undone: false,
      })
      // 同じ activity が二度届いても1行に保つ。
      .onConflictDoNothing({ target: reactions.id });

    const who = remote?.name ?? actorURI ?? "誰か";
    const label =
      kind === "emoji"
        ? `${activity.content ?? "リアクション"} を付けた`
        : kind === "like"
          ? "いいねした"
          : kind === "announce"
            ? "ブーストした"
            : "返信した";
    await notifyDiscord(
      c.env.DISCORD_REACTION_WEBHOOK,
      `${who} が ${SITE_URL}/o/${pageID} を${label}`,
    );

    console.log(
      `[inbox] reaction kind=${kind} pageID=${pageID} id=${reactionID}`,
    );
    return c.text("", 202);
  }

  // 未対応の activity は受け取って捨てる。エラーにすると相手がリトライを続ける。
  console.log(`[inbox] ignored type=${activity.type}`);
  return c.text("", 202);
});

export { inbox };
