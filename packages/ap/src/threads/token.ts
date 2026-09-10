import type { Env } from "../db";
import { notifyDiscord } from "../notify";
import { requestRefresh } from "./client";

export const TOKEN_KEY = "threads:token";

export type StoredToken = {
  accessToken: string;
  // epoch ms。refresh レスポンスの expires_in から算出する。
  expiresAt: number;
  refreshedAt: number;
};

// KV にあればそれ、無ければ seed。seed に対して refresh を掛けないのは
// Threads の refresh が「発行から 24 時間以上」を要求するため。手動 OAuth
// 直後の seed は弾かれる。最初の cron が KV を埋める。
export async function getToken(env: Env): Promise<string> {
  const stored = (await env.KV.get(TOKEN_KEY, "json")) as StoredToken | null;
  return stored?.accessToken ?? env.THREADS_SEED_TOKEN;
}

// cron から呼ぶ。60 日の期限を 60 日に戻す。週1で回すので 8 回続けて
// 失敗しない限りトークンは死なない。
export async function refreshToken(env: Env): Promise<void> {
  const current = await getToken(env);
  const res = await requestRefresh(current);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[threads] refresh failed status=${res.status} ${body}`);
    await notifyDiscord(
      env.DISCORD_REACTION_WEBHOOK,
      `Threads のトークン更新に失敗した (${res.status})。60 日放置すると手動 OAuth からやり直しになる。`,
    );
    throw new Error(`refresh failed: ${res.status}`);
  }

  const body = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  if (!Number.isFinite(body.expires_in)) {
    throw new Error(
      `refresh response missing expires_in: ${JSON.stringify(body)}`,
    );
  }

  const now = Date.now();
  const next: StoredToken = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
    refreshedAt: now,
  };

  await env.KV.put(TOKEN_KEY, JSON.stringify(next));
  console.log(
    `[threads] token refreshed expiresAt=${new Date(next.expiresAt).toISOString()}`,
  );
}

// 401 が返ったトークンは失効している。そのトークンで refresh を叩いても
// 通らないので、Bluesky の invalidateSession のようなリカバリはできない。
// KV を捨てて seed で1度だけやり直し、それも駄目なら手動 OAuth が要る。
export async function withToken(
  env: Env,
  fn: (token: string) => Promise<Response>,
): Promise<Response> {
  const token = await getToken(env);
  const res = await fn(token);
  if (res.status !== 401) return res;

  await env.KV.delete(TOKEN_KEY);

  const seed = env.THREADS_SEED_TOKEN;
  // 同じトークンで2度叩いても結果は変わらない。
  if (!seed || seed === token) {
    await notifyDiscord(
      env.DISCORD_REACTION_WEBHOOK,
      "Threads のトークンが失効した。手動 OAuth からやり直しが必要。",
    );
    return res;
  }

  const retried = await fn(seed);
  if (retried.status === 401) {
    await notifyDiscord(
      env.DISCORD_REACTION_WEBHOOK,
      "Threads のトークンが失効した (seed でも 401)。手動 OAuth からやり直しが必要。",
    );
  }
  return retried;
}
