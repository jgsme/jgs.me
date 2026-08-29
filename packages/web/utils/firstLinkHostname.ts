import type { parse } from "@progfay/scrapbox-parser";

type Blocks = ReturnType<typeof parse>;
type Node = Extract<Blocks[number], { type: "line" }>["nodes"][number];

// 装飾や引用の中にもリンクは入るので、子ノードを持つものは潜る。
function findAbsoluteLink(nodes: readonly Node[]): string | null {
  for (const node of nodes) {
    if (node.type === "link" && node.pathType === "absolute") {
      return node.href;
    }
    // decoration / strong / quote などは nodes を持つ。型定義上は
    // 任意プロパティなので、実体があるときだけ潜る。
    const children = (node as { nodes?: readonly Node[] }).nodes;
    if (children) {
      const found = findAbsoluteLink(children);
      if (found) return found;
    }
  }
  return null;
}

// clip の一覧に「どこの記事か」を出すためのホスト名。
// 本文の生テキストを正規表現で舐めるのではなく、パース済みの構造から取る。
// 記法が増えても取りこぼしにくく、[ページ名] のような相対リンクを
// 誤って外部 URL と見なすこともない。
export function firstLinkHostname(blocks: Blocks): string | null {
  for (const block of blocks) {
    if (block.type !== "line") continue;
    const href = findAbsoluteLink(block.nodes);
    if (!href) continue;
    try {
      return new URL(href).hostname;
    } catch {
      // href が URL として壊れていても一覧の描画は続ける。
      // ドメインが出ないだけで、記事自体は読める。
      return null;
    }
  }
  return null;
}
