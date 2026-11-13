import type { Block, Node as NodeType } from "@progfay/scrapbox-parser";

export type OEmbedProvider = "bluesky" | "spotify";

export type EmbedTarget =
  | { kind: "youtube"; videoId: string }
  | { kind: "oembed"; provider: OEmbedProvider; url: string };

export const OEMBED_ENDPOINTS: Record<OEmbedProvider, string> = {
  bluesky: "https://embed.bsky.app/oembed",
  spotify: "https://open.spotify.com/oembed",
};

const SPOTIFY_PATH =
  // Spotify の埋め込みにできるページの path。locale (intl-ja) は付いていてもよい。
  // "/intl-ja/track/4uLU6hMCjMI75M1A2tKUQC" は通り、種類 "track" と ID
  // "4uLU6hMCjMI75M1A2tKUQC" を拾う。"/prerelease/5RJ8hlD8Dx9XNZFMYbUIHA" も通る。
  // "/user/foo" は通らない。
  // https://regex101.com/?flavor=javascript&regex=%5E%5C%2F(%3F%3Aintl-%5Ba-z%5D%7B2%7D(%3F%3A-%5Ba-z%5D%7B2%7D)%3F%5C%2F)%3F(track%7Calbum%7Cplaylist%7Cepisode%7Cshow%7Cartist%7Cprerelease)%5C%2F(%5BA-Za-z0-9%5D%2B)%5C%2F%3F%24&flags=gm&testString=%2Fintl-ja%2Ftrack%2F4uLU6hMCjMI75M1A2tKUQC%0A%2Fprerelease%2F5RJ8hlD8Dx9XNZFMYbUIHA%0A%2Fuser%2Ffoo
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist|episode|show|artist|prerelease)\/([A-Za-z0-9]+)\/?$/;
// Bluesky の投稿 1 件の path。"/profile/a.bsky.social/post/3kabc" は通り、
// プロフィールだけの "/profile/a.bsky.social" は通らない。
// https://regex101.com/?flavor=javascript&regex=%5E%5C%2Fprofile%5C%2F%5B%5E%2F%5D%2B%5C%2Fpost%5C%2F%5BA-Za-z0-9%5D%2B%5C%2F%3F%24&flags=gm&testString=%2Fprofile%2Fa.bsky.social%2Fpost%2F3kabc%0A%2Fprofile%2Fa.bsky.social
const BSKY_PATH = /^\/profile\/[^/]+\/post\/[A-Za-z0-9]+\/?$/;
// path の末尾の "/" 1 つ。"/profile/a/post/b/" → "/profile/a/post/b"。
// 末尾に "/" が無い "/profile/a/post/b" はそのまま。
// https://regex101.com/?flavor=javascript&regex=%5C%2F%24&flags=gm&testString=%2Fprofile%2Fa%2Fpost%2Fb%2F%0A%2Fprofile%2Fa%2Fpost%2Fb
const TRAILING_SLASH = /\/$/;
const YOUTUBE_EMBED_PREFIX = "/embed/";

export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname === "/watch"
    ) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname.startsWith(YOUTUBE_EMBED_PREFIX)
    ) {
      return parsed.pathname.slice(YOUTUBE_EMBED_PREFIX.length);
    }
  } catch {
    return null;
  }
  return null;
}

// oEmbed に投げる URL は正規化する。キャッシュのキーと、+data.ts が返す
// embeds の引き当てに使うので、ScrapboxNode 側も同じ関数を通す。
export function embedOf(url: string): EmbedTarget | null {
  const videoId = getYouTubeVideoId(url);
  if (videoId) return { kind: "youtube", videoId };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  if (parsed.hostname === "bsky.app" && BSKY_PATH.test(parsed.pathname)) {
    return {
      kind: "oembed",
      provider: "bluesky",
      url: `https://bsky.app${parsed.pathname.replace(TRAILING_SLASH, "")}`,
    };
  }

  const spotify =
    parsed.hostname === "open.spotify.com" &&
    SPOTIFY_PATH.exec(parsed.pathname);
  if (spotify) {
    return {
      kind: "oembed",
      provider: "spotify",
      url: `https://open.spotify.com/${spotify[1]}/${spotify[2]}`,
    };
  }

  return null;
}

// ScrapboxNode が埋め込みにする node なら、その対象。
// 表示名 ([題 URL] の題) は見ない。付いていても埋め込みになる。
export function embedOfNode(node: NodeType): EmbedTarget | null {
  if (node.type !== "link" || node.pathType === "relative") return null;
  return embedOf(node.href);
}

function oembedUrlsOf(nodes: NodeType[]): string[] {
  return nodes.flatMap((node) => {
    const target = embedOfNode(node);
    const own = target?.kind === "oembed" ? [target.url] : [];
    const nested =
      "nodes" in node && Array.isArray(node.nodes)
        ? oembedUrlsOf(node.nodes)
        : [];
    return [...own, ...nested];
  });
}

// 本文中の oEmbed 対象 URL を、出てくる順に重複なしで集める。
// 表のセルは parser がリンクを解釈しないので見ない。
export function collectOEmbedUrls(blocks: Block[]): string[] {
  return [
    ...new Set(
      blocks.flatMap((block) =>
        block.type === "line" ? oembedUrlsOf(block.nodes) : [],
      ),
    ),
  ];
}
