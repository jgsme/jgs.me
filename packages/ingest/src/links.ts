import { parse, type Node } from "@progfay/scrapbox-parser";

// 本文中の内部リンクを集める。URL を正規表現で拾わず、読み側 (web の
// ScrapboxNode / ap の scrapboxToHtml) と同じ scrapbox-parser を通す。
// firstImage.ts と同じ理由で、判定がずれると「画面上はリンクなのに索引に
// 無い」「コードブロックに書いた [foo] を拾う」が起きる。
function collect(nodes: readonly Node[], out: Set<string>): void {
  for (const node of nodes) {
    // pathType === "relative" が内部リンク。ScrapboxNode.tsx がこの条件で
    // /pages/<href> へ飛ばしているので、索引もこれに揃える。
    if (node.type === "link" && node.pathType === "relative") {
      out.add(node.href);
      continue;
    }
    if (node.type === "hashTag") {
      out.add(node.href);
      continue;
    }
    // decoration / strong / quote は子ノードを持つ。装飾の中のリンクも
    // 本文ではリンクとして出るので、降りて探す。
    if ("nodes" in node) collect(node.nodes, out);
  }
}

// body は 1 行目が題の Scrapbox 記法テキスト (R2 に置いてある形)。
// 題は parse が title ブロックとして返すので、自己参照を落とすために使う。
export function extractLinks(body: string): string[] {
  if (!body.trim()) return [];

  const out = new Set<string>();
  let selfTitle = "";

  for (const block of parse(body)) {
    if (block.type === "title") {
      selfTitle = block.text;
      continue;
    }
    if (block.type === "line") {
      collect(block.nodes, out);
      continue;
    }
    if (block.type === "table") {
      for (const row of block.cells) {
        for (const cell of row) collect(cell, out);
      }
    }
    // codeBlock は本文でもリンクにならないので見ない。
  }

  out.delete(selfTitle);
  return [...out];
}
