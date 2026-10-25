import {
  OEMBED_ENDPOINTS,
  embedOf,
  type OEmbedProvider,
} from "@/pages/article/@title/components/embed";

export type OEmbed =
  | { provider: "bluesky"; html: string }
  | { provider: "spotify"; src: string; height: number; title: string };

export type OEmbeds = Record<string, OEmbed>;

const TIMEOUT_MS = 2000;
// 1ページで叩く上限。超えたぶんは普通のリンクのまま出す。
const MAX_PER_PAGE = 10;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type OEmbedResponse = { html?: unknown; height?: unknown; title?: unknown };

// bsky の html は blockquote + embed.js の script。script は捨てて、
// クライアントで embed.js を1回だけ読む (BlueskyEmbed)。
export function sanitizeBluesky(html: string): string | null {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
  if (
    !/^<blockquote class="bluesky-embed" data-bluesky-uri="at:\/\//.test(
      stripped,
    )
  ) {
    return null;
  }
  if (
    /<(?:script|iframe|style|link|img|object|embed)\b|\son\w+=/i.test(stripped)
  ) {
    return null;
  }
  return stripped;
}

// Spotify の html は iframe 1つ。中身をそのまま流さず、src と高さだけ拾って
// 自前の iframe で出す。
export function parseSpotify(
  body: OEmbedResponse,
): { src: string; height: number; title: string } | null {
  if (typeof body.html !== "string") return null;
  const m = /\ssrc="([^"]+)"/.exec(body.html);
  if (!m) return null;
  let src: URL;
  try {
    src = new URL(m[1]);
  } catch {
    return null;
  }
  if (
    src.origin !== "https://open.spotify.com" ||
    !src.pathname.startsWith("/embed/")
  ) {
    return null;
  }
  const height = typeof body.height === "number" ? body.height : 152;
  const title = typeof body.title === "string" ? body.title : "Spotify";
  return { src: src.toString(), height, title };
}

async function fetchOne(
  provider: OEmbedProvider,
  url: string,
  fetcher: Fetcher,
): Promise<OEmbed | null> {
  const endpoint = new URL(OEMBED_ENDPOINTS[provider]);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");
  if (provider === "bluesky") endpoint.searchParams.set("maxwidth", "600");

  const res = await fetcher(endpoint.toString(), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.log(`[oembed] ${provider} ${res.status} ${url}`);
    return null;
  }
  const body = (await res.json()) as OEmbedResponse;

  if (provider === "bluesky") {
    const html =
      typeof body.html === "string" ? sanitizeBluesky(body.html) : null;
    return html ? { provider, html } : null;
  }
  const spotify = parseSpotify(body);
  return spotify ? { provider, ...spotify } : null;
}

// 失敗した URL は結果に入らない。ScrapboxNode は普通のリンクとして出す。
export async function fetchOEmbeds(
  urls: string[],
  fetcher: Fetcher = fetch,
): Promise<OEmbeds> {
  const targets = urls.slice(0, MAX_PER_PAGE).flatMap((url) => {
    const t = embedOf(url);
    return t?.kind === "oembed" ? [t] : [];
  });
  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        return [t.url, await fetchOne(t.provider, t.url, fetcher)] as const;
      } catch (e) {
        console.log(`[oembed] ${t.provider} error ${t.url} ${String(e)}`);
        return [t.url, null] as const;
      }
    }),
  );
  const out: OEmbeds = {};
  for (const [url, embed] of results) if (embed) out[url] = embed;
  return out;
}
