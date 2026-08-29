import type { Node, parse } from "@progfay/scrapbox-parser";

type Blocks = ReturnType<typeof parse>;

// 装飾や引用の中にもリンクは入るので、子ノードを持つものは潜る。
// nodes プロパティは quote / strong / decoration / numberList では必須で、
// 持たない variant (link, plain など) と区別するために in で絞る
// (cast は不要)。
// 絶対リンクは 1 本に絞らず出現順に全部集める。先頭が壊れた URL でも、
// 後続の正しいリンクを firstLinkHostname 側で試せるようにするため。
function collectAbsoluteLinks(nodes: readonly Node[]): string[] {
  const hrefs: string[] = [];
  for (const node of nodes) {
    if (node.type === "link" && node.pathType === "absolute") {
      hrefs.push(node.href);
    }
    if ("nodes" in node) {
      hrefs.push(...collectAbsoluteLinks(node.nodes));
    }
  }
  return hrefs;
}

// clip の一覧に「どこの記事か」を出すためのホスト名。
// 本文の生テキストを正規表現で舐めるのではなく、パース済みの構造から取る。
// 記法が増えても取りこぼしにくく、[ページ名] のような相対リンクを
// 誤って外部 URL と見なすこともない。
export function firstLinkHostname(blocks: Blocks): string | null {
  const hrefs = blocks.flatMap((block) =>
    block.type === "line" ? collectAbsoluteLinks(block.nodes) : [],
  );
  for (const href of hrefs) {
    try {
      return new URL(href).hostname;
    } catch {
      // この href が壊れていても、出現順で後続のリンクを試す。
      // 1 本目が壊れているせいで後ろの正しいリンクを見逃さないようにする。
    }
  }
  return null;
}
