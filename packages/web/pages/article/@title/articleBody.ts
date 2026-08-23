import { parse } from "@progfay/scrapbox-parser";
import { purifyScrapboxText } from "@/utils/purifyScrapboxText";

export type ArticleBody = {
  blocks: ReturnType<typeof parse>;
  fromDate: string | null;
  description: string;
};

// text は Scrapbox 記法で1行目が題。parse() の既定 (hasTitle: true) が
// 先頭を title ブロックにするので、それを filter で落とす。
export function buildArticleBody(text: string): ArticleBody {
  const blocks = parse(text);
  let fromDate: string | null = null;
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
          const match = secondNode.href.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            fromDate = `${year}/${month}/${day}`;
            skipLines = 2;
          }
        }
      }
    }
  }

  let dateLineIndex: number | null = null;
  if (!fromDate) {
    for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 5); i--) {
      const block = blocks[i];
      if (block.type !== "line") continue;
      for (const node of block.nodes) {
        if (node.type === "hashTag") {
          const match = node.href.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            fromDate = `${year}/${month}/${day}`;
            dateLineIndex = i;
            break;
          }
        }
      }
      if (fromDate) break;
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
