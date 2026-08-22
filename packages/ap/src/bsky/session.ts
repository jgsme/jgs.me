import type { Env } from "../db";
import { USER_AGENT } from "../config";

const ENTRYWAY = "https://bsky.social";
const CACHE_KEY = "bsky:session";
// accessJwt は約 2 時間で切れる。少し手前で作り直す。
const CACHE_TTL = 90 * 60;

export type Session = {
  did: string;
  accessJwt: string;
  refreshJwt: string;
};

// createSession はアカウントあたり 30 / 5分、300 / 日。
// 毎リクエストでログインすると簡単に上限に当たるため KV にキャッシュする。
export async function getSession(env: Env): Promise<Session> {
  const cached = await env.KV.get(CACHE_KEY, "json");
  if (cached) return cached as Session;

  const res = await fetch(`${ENTRYWAY}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      identifier: env.BSKY_HANDLE,
      password: env.BSKY_APP_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error(`createSession failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    did: string;
    accessJwt: string;
    refreshJwt: string;
  };

  const session: Session = {
    did: body.did,
    accessJwt: body.accessJwt,
    refreshJwt: body.refreshJwt,
  };

  await env.KV.put(CACHE_KEY, JSON.stringify(session), {
    expirationTtl: CACHE_TTL,
  });

  return session;
}

// 401 が返ったらキャッシュを捨てて次回に作り直させる。
export async function invalidateSession(env: Env): Promise<void> {
  await env.KV.delete(CACHE_KEY);
}

export { ENTRYWAY };
