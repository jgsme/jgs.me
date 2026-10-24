const GRAIN_ORIGIN = "https://grain.social/";

// Micropub 通知の mf2 (JSON 文字列) から Grain の gallery URL を取り出す。
// properties.syndication のうち https://grain.social/ で始まる最初の文字列だけ。
export function grainUrlFromMf2(mf2: string | null): string | null {
  if (!mf2) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(mf2);
  } catch {
    return null;
  }
  const props = (parsed as { properties?: { syndication?: unknown } } | null)
    ?.properties;
  const list = props?.syndication;
  if (!Array.isArray(list)) return null;
  const hit = list.find(
    (v): v is string => typeof v === "string" && v.startsWith(GRAIN_ORIGIN),
  );
  return hit ?? null;
}

// https://grain.social/profile/<actor>/gallery/<rkey> を gallery の at-uri にする。
// 形が違えば null。
export function galleryAtUri(grainUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(grainUrl);
  } catch {
    return null;
  }
  if (url.origin !== "https://grain.social") return null;
  const m = /^\/profile\/([^/]+)\/gallery\/([^/]+)$/.exec(url.pathname);
  if (!m) return null;
  try {
    return `at://${decodeURIComponent(m[1]!)}/social.grain.gallery/${m[2]}`;
  } catch {
    return null;
  }
}

// Grain の AppView が gallery をまだ取り込んでいない間は、URL を投稿しても
// リンク先が 404 になる。待てば直るので、通常の失敗と区別して遅延 retry する。
export class GrainNotIndexedError extends Error {
  constructor(atUri: string) {
    super(`grain.social に gallery が取り込まれていない: ${atUri}`);
    this.name = "GrainNotIndexedError";
  }
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// getGallery が 200 を返したら取り込み済み。未取り込みは 400 (Gallery not found)、
// 一時障害は 502 などで返るので、200 以外とネットワーク失敗は全部「まだ」とみなす。
// Workers の fetch は素の参照を渡すと Illegal invocation になるのでラップする。
export async function isGrainIndexed(
  atUri: string,
  f: FetchFn = (i, init) => fetch(i, init),
): Promise<boolean> {
  try {
    const res = await f(
      `https://grain.social/xrpc/social.grain.unspecced.getGallery?gallery=${encodeURIComponent(atUri)}`,
    );
    return res.status === 200;
  } catch {
    return false;
  }
}
