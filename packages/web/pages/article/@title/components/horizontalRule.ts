import type { Block } from "@progfay/scrapbox-parser";

/**
 * `---` だけの行を水平線として扱う。
 * Scrapbox 記法に水平線は無いので、パーサからは plain node 1 個の line として降りてくる。
 * `----` 以上やインデント付きは対象外 (箇条書きの中の水平線は意味を成さない)。
 */
export function isHorizontalRule(block: Block): boolean {
  if (block.type !== "line") return false;
  if (block.indent !== 0) return false;
  if (block.nodes.length !== 1) return false;
  const node = block.nodes[0];
  return node.type === "plain" && node.text === "---";
}
