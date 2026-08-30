import { parse, type Node } from "@progfay/scrapbox-parser";
import type { Entry } from "./mf2";

// 一覧のサムネ (page.image) に使う本文中の先頭画像。
//
// URL を正規表現で拾うのではなく、読み側 (web の ScrapboxNode / ap の
// scrapboxToHtml) と同じ scrapbox-parser を通す。両者の判定がずれると
// 「本文には出ていない画像がサムネになる」「コードブロックに貼った URL を
// 拾う」といった食い違いが起きる。
function findInNodes(nodes: readonly Node[]): string | null {
  for (const node of nodes) {
    if (node.type === "image" || node.type === "strongImage") return node.src;
    // decoration / strong / quote は子ノードを持つ。装飾の中に置いた画像も
    // 本文では画像として出るので、降りて探す。
    if ("nodes" in node) {
      const found = findInNodes(node.nodes);
      if (found) return found;
    }
  }
  return null;
}

// content は題を含まない本文 (mf2 の content)。R2 に置く .sb と違って
// 1行目が題ではないので、hasTitle: false で読む。
export function firstImageURL(content: string): string | null {
  if (!content.trim()) return null;

  for (const block of parse(content, { hasTitle: false })) {
    if (block.type === "line") {
      const found = findInNodes(block.nodes);
      if (found) return found;
      continue;
    }
    if (block.type === "table") {
      for (const row of block.cells) {
        for (const cell of row) {
          const found = findInNodes(cell);
          if (found) return found;
        }
      }
    }
    // codeBlock は本文でも画像にならないので見ない。
  }
  return null;
}

// page.image に入れる URL。photo は投稿者が明示したサムネなので本文より優先する。
export function pageImage(entry: Entry): string | null {
  return entry.photo ?? firstImageURL(entry.content);
}
