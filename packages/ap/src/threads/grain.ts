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
