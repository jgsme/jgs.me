import type { Env } from "../db";
import { notifyDiscord } from "../notify";
import { requestRefresh } from "./client";

export const TOKEN_KEY = "threads:token";
// 通知の重複抑止用。理由ごとに別キーにして、種類の違う事故が
// 巻き添えで握り潰されないようにする。
export const NOTIFY_KEY_PREFIX = "threads:notified:";
const NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type StoredToken = {
  accessToken: string;
  // epoch ms。refresh レスポンスの expires_in から算出する。
  expiresAt: number;
  refreshedAt: number;
};

// 同じ理由の通知は 24 時間に1度だけ流す。トークンが死ぬと投稿1件あたり
// (初回 + retry) 回ぶん同じ文面が飛ぶので、そのままだと通知が埋まる。
async function notifyOnce(
  env: Env,
  reason: string,
  text: string,
): Promise<void> {
  const key = `${NOTIFY_KEY_PREFIX}${reason}`;
  const now = Date.now();
  const last = await env.KV.get(key);
  if (last !== null) {
    const at = Number(last);
    if (Number.isFinite(at) && now - at < NOTIFY_WINDOW_MS) return;
  }

  await env.KV.put(key, String(now), {
    expirationTtl: NOTIFY_WINDOW_MS / 1000,
  });
  await notifyDiscord(env.DISCORD_REACTION_WEBHOOK, text);
}

// 失効・無効トークンの見分け方。
// - 401: 素直に認証エラーとして返ってくるケース。
// - 400 + error.code 190 (OAuthException): Meta の Graph API が失効トークンを
//   こう返す慣例がある。**これは Graph API 全体の慣例からの推測で、Threads で
//   実際に観測したものではない**。401 の側だけが確認済みだと思って読むこと。
// body を読むと Response が消費されるので clone で覗く。JSON でない 400 は
// ここで throw させない。
async function isCredentialFailure(res: Response): Promise<boolean> {
  if (res.status === 401) return true;
  if (res.status !== 400) return false;

  try {
    const body = (await res.clone().json()) as {
      error?: { code?: number };
    } | null;
    return body?.error?.code === 190;
  } catch {
    return false;
  }
}

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

  // access_token が欠けたまま書くと expiresAt だけが残って、存在しない
  // トークンについての嘘になる。両方揃っているときだけ KV を更新する。
  if (
    typeof body.access_token !== "string" ||
    body.access_token === "" ||
    !Number.isFinite(body.expires_in)
  ) {
    throw new Error(
      `refresh response missing access_token/expires_in: ${JSON.stringify(body)}`,
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

// 認証エラーが返ったトークンは失効している。そのトークンで refresh を叩いても
// 通らないので、Bluesky の invalidateSession のようなリカバリはできない。
// seed で1度だけやり直し、それも駄目なら手動 OAuth が要る。
//
// KV を消すのは「seed で通った = KV のトークンが本当に死んでいる」と分かった
// 後だけ。運用 60 日目以降は cron が回している KV の方が生きていて seed が
// 死んでいるので、先に消すと一過性の 401 で唯一生きた資格情報を捨てて
// しまう (そのあと getToken は死んだ seed を返し続ける)。
export async function withToken(
  env: Env,
  fn: (token: string) => Promise<Response>,
): Promise<Response> {
  const token = await getToken(env);
  const res = await fn(token);
  if (!(await isCredentialFailure(res))) return res;

  const seed = env.THREADS_SEED_TOKEN;
  // 同じトークンで2度叩いても結果は変わらない。
  if (!seed || seed === token) {
    await notifyOnce(
      env,
      "no-seed",
      "Threads のトークンが失効した。手動 OAuth からやり直しが必要。",
    );
    return res;
  }

  const retried = await fn(seed);
  if (await isCredentialFailure(retried)) {
    // seed も駄目。KV のトークンが死んでいる確証は無いので消さない。
    await notifyOnce(
      env,
      "seed-dead",
      "Threads のトークンが失効した (seed でも認証エラー)。手動 OAuth からやり直しが必要。",
    );
    return retried;
  }

  await env.KV.delete(TOKEN_KEY);
  return retried;
}
