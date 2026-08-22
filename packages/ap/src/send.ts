import { guardURL } from "./urlguard";
import { discoverEndpoint } from "./discovery";
import type { SendMessage } from "./db";

export async function sendWebmention(msg: SendMessage): Promise<void> {
  const endpoint = await discoverEndpoint(msg.target);
  if (!endpoint) {
    // Webmention を受け付けていないサイトが大多数。これは正常系。
    console.log(`[wm-send] no endpoint target=${msg.target}`);
    return;
  }

  // endpoint も外部入力由来なので検査する。
  const guard = guardURL(endpoint);
  if (!guard.ok) {
    console.log(`[wm-send] bad endpoint=${endpoint} reason=${guard.reason}`);
    return;
  }

  const body = new URLSearchParams({
    source: msg.source,
    target: msg.target,
  });

  const res = await fetch(guard.url.href, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  console.log(
    `[wm-send] target=${msg.target} endpoint=${guard.url.href} status=${res.status}`,
  );
}
