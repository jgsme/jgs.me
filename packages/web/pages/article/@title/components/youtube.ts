import type { Node as NodeType } from "@progfay/scrapbox-parser";

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

// ScrapboxNode が iframe にする node なら、その動画 ID。
// 表示名 ([題 URL] の題) は見ない。付いていても iframe になる。
export function youTubeIdOfNode(node: NodeType): string | null {
  if (node.type !== "link" || node.pathType === "relative") return null;
  return getYouTubeVideoId(node.href);
}
