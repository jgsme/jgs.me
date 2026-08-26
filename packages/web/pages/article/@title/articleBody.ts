import { parse } from "@progfay/scrapbox-parser";
import { extractBodyDate } from "@jigsaw/db/article-date";
import { purifyScrapboxText } from "@/utils/purifyScrapboxText";

export type ArticleBody = {
  blocks: ReturnType<typeof parse>;
  fromDate: string | null;
  description: string;
};

// text は Scrapbox 記法で1行目が題。parse() の既定 (hasTitle: true) が
// 先頭を title ブロックにするので、それを filter で落とす。
//
// 日付の値そのものは @jigsaw/db/article-date に一本化してある。ここが持つのは
// 「日付を書いた行を本文から落とす」判定だけ。値と位置の判定条件は同じなので、
// 片方だけ変えると表示に日付行が残る。
export function buildArticleBody(text: string): ArticleBody {
  const blocks = parse(text);
  const fromDate = extractBodyDate(text);
  let skipLines = 0;

  const firstLineIndex = blocks.findIndex(
    (b) => b.type === "line" && b.nodes.length > 0,
  );

  if (firstLineIndex !== -1) {
    const firstLine = blocks[firstLineIndex];
    if (firstLine.type === "line" && firstLine.nodes.length > 0) {
      const firstNode = firstLine.nodes[0];

      if (
        firstNode.type === "plain" &&
        firstNode.text.trim() === "from" &&
        firstLine.nodes.length >= 2
      ) {
        const secondNode = firstLine.nodes[1];
        if (secondNode.type === "link" && secondNode.pathType === "relative") {
          if (/^\d{8}$/.test(secondNode.href)) skipLines = 2;
        }
      }
    }
  }

  let dateLineIndex: number | null = null;
  if (skipLines === 0) {
    for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 5); i--) {
      const block = blocks[i];
      if (block.type !== "line") continue;
      const hit = block.nodes.some(
        (node) => node.type === "hashTag" && /^\d{8}$/.test(node.href),
      );
      if (hit) {
        dateLineIndex = i;
        break;
      }
    }
  }

  let lineCount = 0;
  const filteredBlocks = blocks.filter((block, index) => {
    if (block.type === "title") return false;
    if (block.type === "line" && skipLines > 0) {
      lineCount++;
      if (lineCount <= skipLines) return false;
    }
    if (dateLineIndex !== null && index === dateLineIndex) return false;
    return true;
  });

  const rawDescription = filteredBlocks
    .filter((b) => b.type === "line")
    .map((b) => (b.type === "line" ? b.nodes.map((n) => n.raw).join("") : ""))
    .join("\n");

  return {
    blocks: filteredBlocks,
    fromDate,
    description: purifyScrapboxText(rawDescription).slice(0, 200),
  };
}
