import { parse, type Node } from "@progfay/scrapbox-parser";
import { parseMoteUrl, type MoteRef } from "@jigsaw/db/mote";
import { findInNodes } from "./firstImage";

// 読み側 (web の ScrapboxNode / ap の scrapboxToHtml) と同じ scrapbox-parser を
// 通す。コードブロックに貼った URL を拾わないため。
const moteOf = (node: Node): MoteRef | null =>
  node.type === "link" && node.pathType !== "relative"
    ? parseMoteUrl(node.href)
    : null;

/** Scrapbox 記法の本文から最初の mote の URL を返す。無ければ null */
export function firstMoteUrl(content: string): MoteRef | null {
  if (!content.trim()) return null;

  for (const block of parse(content, { hasTitle: false })) {
    // 表のセルは parser がリンクにしない (本文でも埋め込みにならない)。
    // codeBlock もリンクにならない。どちらも見ない。
    if (block.type !== "line") continue;
    const found = findInNodes(block.nodes, moteOf);
    if (found) return found;
  }
  return null;
}
