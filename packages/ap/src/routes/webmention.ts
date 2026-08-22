import { Hono } from "hono";
import type { Env } from "../db";
import { guardURL } from "../urlguard";
import { SITE_URL } from "../config";

const webmention = new Hono<{ Bindings: Env }>();

// 同一ホストからの受信レート制限。送信元1ホストあたり1時間で 30 件。
const RATE_LIMIT = 30;
const RATE_WINDOW = 3600;

// Webmention 仕様は非同期処理を許しており 202 を返してよい。
// source の取得は外部への fetch なので、endpoint では受け取るだけにして
// 検証を Queue に逃がす。これで受信側が遅い相手に引きずられない。
webmention.post("/webmention", async (c) => {
  const form = await c.req.parseBody();
  const source = form["source"];
  const target = form["target"];

  if (typeof source !== "string" || typeof target !== "string") {
    return c.text("source and target are required", 400);
  }
  if (source === target) {
    return c.text("source and target must differ", 400);
  }

  const guard = guardURL(source);
  if (!guard.ok) return c.text(`invalid source: ${guard.reason}`, 400);

  // target が自サイトを指していることだけ先に見る。
  // 公開記事かどうかは Queue 側で確認する。
  let t: URL;
  try {
    t = new URL(target);
  } catch {
    return c.text("invalid target", 400);
  }
  if (t.origin !== new URL(SITE_URL).origin) {
    return c.text("target is not on this site", 400);
  }

  // KV は結果整合なので厳密なカウントにはならない。大量送信を落とすのが
  // 目的なのでこれで足りる。put するたび TTL が延びるため、実質は
  // 「直近1時間無送信になるまで」窓が続く。
  const rateKey = `wm:rate:${guard.url.hostname}`;
  const seen = Number((await c.env.KV.get(rateKey)) ?? "0");
  if (seen >= RATE_LIMIT) {
    console.log(`[webmention] rate limited host=${guard.url.hostname}`);
    return c.text("too many requests", 429);
  }
  await c.env.KV.put(rateKey, String(seen + 1), { expirationTtl: RATE_WINDOW });

  await c.env.WEBMENTION.send({ source, target });
  return c.text("", 202);
});

export { webmention };
