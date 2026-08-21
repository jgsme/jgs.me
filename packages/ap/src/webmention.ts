import { eq } from "drizzle-orm";
import { articles, pages, reactions } from "@jigsaw/db";
import { getDB, type Env, type WebmentionMessage } from "./db";
import { MAX_BODY_BYTES, MAX_REDIRECTS, guardURL } from "./urlguard";
import { extractMf2 } from "./mf2extract";
import { SITE_URL, USER_AGENT } from "./config";
import { notifyDiscord } from "./notify";

export type FetchResult =
  | { ok: true; html: string; finalURL: string }
  | { ok: false; reason: string };

// リダイレクトを自動で追わせない。各 hop で宛先を再検査するため、
// redirect: "manual" にして自前でループを回す。
export async function fetchSource(source: string): Promise<FetchResult> {
  let current = source;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = guardURL(current);
    if (!guard.ok) return { ok: false, reason: `guard:${guard.reason}` };

    // 名前解決できないホストやタイムアウトで fetch は throw する。ここで
    // 握らないと consumer が msg.retry() を呼び、死んだ source に対して
    // max_retries ぶん無駄に投げ直すことになる。
    let res: Response;
    try {
      res = await fetch(guard.url.href, {
        redirect: "manual",
        headers: {
          Accept: "text/html, */*;q=0.5",
          // UA なしのリクエストを別ホストへ 301 するサーバが実在する (config.ts)。
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      return { ok: false, reason: `fetch-error:${String(e)}` };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) return { ok: false, reason: "redirect-no-location" };
      // 相対 Location を絶対化してから次の hop で再検査する。
      current = new URL(loc, guard.url).href;
      continue;
    }

    // 410 は「消えた」の意思表示。呼び出し側が反応の削除に使う。
    if (res.status === 410) return { ok: false, reason: "gone" };
    if (!res.ok) return { ok: false, reason: `status:${res.status}` };

    const len = Number(res.headers.get("Content-Length") ?? "0");
    if (len > MAX_BODY_BYTES) return { ok: false, reason: "too-large" };

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return { ok: false, reason: "too-large" };
    }

    return {
      ok: true,
      html: new TextDecoder().decode(buf),
      // リダイレクト後の URL。source 内の相対 URL はこれを基準に解決する。
      finalURL: guard.url.href,
    };
  }

  return { ok: false, reason: "too-many-redirects" };
}

// タイトルに % を含むページが実在する ("%キ" など)。URL パーサは裸の % を
// そのまま残すので pathname が "/pages/%%E3%82%AD" になり、全体を
// decodeURIComponent すると URIError で落ちる。consumer 側の retry ループを
// 避けるだけでなく、記事を引けるようにするため、正しい %XX 列だけを解く。
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, (seq) => {
      try {
        return decodeURIComponent(seq);
      } catch {
        return seq;
      }
    });
  }
}

export type ParsedTarget =
  | { by: "id"; id: number }
  | { by: "title"; title: string };

// target の URL から、どの記事を指しているかだけを読む。DB は引かない。
// 受け付けるのは /o/<n> / /p/<n> / /pages/<title> の3つ (spec §9)。
export function parseTarget(
  target: string,
  siteUrl: string,
): ParsedTarget | null {
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return null;
  }
  if (u.origin !== new URL(siteUrl).origin) return null;

  const byID = u.pathname.match(/^\/(?:o|p)\/(\d+)\/?$/);
  if (byID) return { by: "id", id: Number(byID[1]) };

  const byTitle = u.pathname.match(/^\/pages\/(.+?)\/?$/);
  if (byTitle) return { by: "title", title: safeDecode(byTitle[1]!) };

  return null;
}

// 公開済み (article に行がある) のものだけ受け付ける。
export async function resolveTarget(
  target: string,
  siteUrl: string,
  db: ReturnType<typeof getDB>,
): Promise<number | null> {
  const parsed = parseTarget(target, siteUrl);
  if (parsed === null) return null;

  const rows = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(articles, eq(articles.pageID, pages.id))
    .where(
      parsed.by === "id"
        ? eq(pages.id, parsed.id)
        : eq(pages.title, parsed.title),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function processWebmention(
  msg: WebmentionMessage,
  env: Env,
): Promise<void> {
  const db = getDB(env.DB);

  const pageID = await resolveTarget(msg.target, SITE_URL, db);
  if (pageID === null) {
    console.log(`[webmention] unknown target=${msg.target}`);
    return;
  }

  // source ごと target ごとに1行。同じ組み合わせの再送は更新になる。
  const reactionID = `wm:${msg.source}:${msg.target}`;

  const fetched = await fetchSource(msg.source);
  if (!fetched.ok) {
    // source が消えていたら反応も消す。
    if (fetched.reason === "gone") {
      await db.delete(reactions).where(eq(reactions.id, reactionID));
      console.log(`[webmention] source gone, removed ${reactionID}`);
      return;
    }
    console.log(`[webmention] fetch failed ${msg.source} ${fetched.reason}`);
    return;
  }

  // 相対 URL は最終 URL 基準で解決させる。生のまま保存すると
  // actorIcon="/avatar.png" が jgs.me 基準で解決されて壊れる。
  const mf2 = await extractMf2(fetched.html, msg.target, fetched.finalURL);

  // Webmention 仕様が要求する検証。
  // source に target へのリンクが無ければ受け付けない。
  if (!mf2.linksTo) {
    await db.delete(reactions).where(eq(reactions.id, reactionID));
    console.log(`[webmention] no link to target, rejected ${msg.source}`);
    return;
  }

  // bookmark は表示上の区別を持たないので mention に丸める (計画5 の Reactions)。
  const kind =
    mf2.kind === "repost"
      ? "announce"
      : mf2.kind === "bookmark"
        ? "mention"
        : mf2.kind;

  const actorName = mf2.authorName ?? new URL(msg.source).hostname;
  const actorURL = mf2.authorURL ?? msg.source;

  await db
    .insert(reactions)
    .values({
      id: reactionID,
      targetPageID: pageID,
      sourceProtocol: "web",
      kind,
      emoji: null,
      actorName,
      actorURL,
      actorIcon: mf2.authorPhoto,
      // 本文は取らない (完全な mf2 パーサを書かないため)。計画5 の Reactions は
      // content が空なら段落ごと出さない実装にしてある。
      content: null,
      created: new Date().toISOString(),
      undone: false,
    })
    .onConflictDoUpdate({
      target: reactions.id,
      set: {
        kind,
        actorName,
        actorURL,
        actorIcon: mf2.authorPhoto,
        undone: false,
      },
    });

  // notifyDiscord は内部で例外を握る。ここで throw されないので、
  // Queue の retry で二重通知になることはない。
  await notifyDiscord(
    env.DISCORD_REACTION_WEBHOOK,
    `${actorName} が ${SITE_URL}/o/${pageID} に言及 (${kind})`,
  );

  console.log(
    `[webmention] accepted kind=${kind} pageID=${pageID} source=${msg.source}`,
  );
}
