import type { Env } from "./index";

// 記事ページはエッジに載る (web の +server.ts)。消さないと
// 差し替えた本文も改題も TTL が切れるまで出てこない。
// 失敗しても呼び出し元の更新自体は成功させる。
export async function purge(env: Env, paths: string[]): Promise<void> {
  try {
    const res = await env.WEB.fetch("https://web.internal/internal/purge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PURGE_TOKEN}`,
      },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      console.error(`[purge] status=${res.status} paths=${paths.join(",")}`);
    }
  } catch (e) {
    console.error(`[purge] failed ${String(e)}`);
  }
}
