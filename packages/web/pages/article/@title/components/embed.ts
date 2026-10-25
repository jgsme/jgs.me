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
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)\/?$/;
const BSKY_PATH = /^\/profile\/[^/]+\/post\/[A-Za-z0-9]+\/?$/;

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
      parsed.pathname.startsWith("/embed/")
    ) {
      return parsed.pathname.slice(7);
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
      url: `https://bsky.app${parsed.pathname.replace(/\/$/, "")}`,
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

function walk(nodes: NodeType[], out: Set<string>) {
  for (const node of nodes) {
    const target = embedOfNode(node);
    if (target?.kind === "oembed") out.add(target.url);
    if ("nodes" in node && Array.isArray(node.nodes)) walk(node.nodes, out);
  }
}

// 本文中の oEmbed 対象 URL を、出てくる順に重複なしで集める。
// 表のセルは parser がリンクを解釈しないので見ない。
export function collectOEmbedUrls(blocks: Block[]): string[] {
  const out = new Set<string>();
  for (const block of blocks) {
    if (block.type === "line") walk(block.nodes, out);
  }
  return [...out];
}
