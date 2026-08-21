export const MAX_REDIRECTS = 5;
export const MAX_BODY_BYTES = 1_000_000;

export type GuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: "parse" | "scheme" | "host" };

const ALLOWED_SCHEMES = ["http:", "https:"];

// IP リテラルを弾く。Workers の fetch は private IP に到達しないが、
// 到達しない先へのリクエストを投げること自体を避ける。
// URL パーサが 2130706433 や 0x7f000001 を 127.0.0.1 に正規化した後で
// 見るため、ドット区切りだけ見れば足りる。
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function isIPLiteral(host: string): boolean {
  // URL は IPv6 を [..] で括る。
  if (host.startsWith("[") && host.endsWith("]")) return true;
  return IPV4.test(host);
}

export function guardURL(raw: string): GuardResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "parse" };
  }

  // scheme を先に見る。file: / javascript: / data: は hostname が空になるため、
  // 空チェックを先に置くと理由が "parse" に化ける。
  if (!ALLOWED_SCHEMES.includes(url.protocol)) {
    return { ok: false, reason: "scheme" };
  }
  // http/https でホストが空の URL は new URL が投げるのでここには来ないが、
  // パーサの挙動に依存させたくないので残す。
  if (!url.hostname) return { ok: false, reason: "parse" };

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "host" };
  }
  if (isIPLiteral(host)) return { ok: false, reason: "host" };

  return { ok: true, url };
}
