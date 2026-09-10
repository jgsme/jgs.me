import { parse } from "@progfay/scrapbox-parser";
import { mdKeyOf } from "@jigsaw/db/body-key";

type Blocks = ReturnType<typeof parse>;
type Line = Extract<Blocks[number], { type: "line" }>;
type Node = Line["nodes"][number];

function nodeText(node: Node): string {
  switch (node.type) {
    case "plain":
      return node.text;
    case "decoration":
      return node.nodes.map(nodeText).join("");
    // リンク先の URL は落とす。内部リンクは [ページ名] で content が空なので
    // href がそのままリンクテキスト、外部リンクは content がテキスト。
    case "link":
      return node.pathType === "absolute" ? node.content : node.href;
    case "hashTag":
      return `#${node.href}`;
    case "quote":
      return `> ${node.nodes.map(nodeText).join("").trim()}`;
    // image を含め、残りは URL しか持たないので落とす。
    default:
      return "";
  }
}

// 行全体が [* ...] だけの行は見出しとして書かれている。
function headingText(line: Line): string | null {
  if (line.nodes.length !== 1) return null;
  const node = line.nodes[0];
  if (node?.type !== "decoration") return null;
  if (!node.decos.some((d) => d.startsWith("*"))) return null;
  return node.nodes.map(nodeText).join("");
}

// 入力は fetchBody() の出力 (Scrapbox 記法、1行目が題)。
export function toMarkdown(text: string): string {
  const out: string[] = [];
  let title = "";

  for (const block of parse(text)) {
    if (block.type === "title") {
      title = block.text.trim();
      out.push(`# ${block.text}`, "");
      continue;
    }
    if (block.type !== "line") continue;

    const heading = headingText(block);
    if (heading !== null) {
      out.push(`## ${heading}`);
      continue;
    }

    const body = block.nodes.map(nodeText).join("");

    // clip の本文は 1 行目の題のあとにもう一度題が入っていることがある。
    // 題を 2 回埋め込んでも検索の役に立たない。インデントは無視して見る。
    if (title !== "" && body.trim() === title) continue;

    // Scrapbox のインデントは箇条書き相当。深さぶんネストさせる。
    if (block.indent > 0) {
      out.push(`${"  ".repeat(block.indent - 1)}- ${body}`);
      continue;
    }

    out.push(body);
  }

  // 末尾の空行を残すと、本文が空かどうかを呼び出し側が判定できない。
  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  return out.join("\n");
}

export interface MdPut {
  key: string;
  body: string;
  contentType: string;
}

// 検索用の派生物を w-md に書く内容 (key / body / contentType) を組み立てる。
// sbBody は原本と同じ「1行目が題の Scrapbox 記法」。create / update が
// R2 に書くのと同じ文字列を渡す。ここを経由させることで、原本と派生物が
// 同じ本文から作られていることをユニットテストで固定できる。
export function buildMdPut(bodyKey: string, sbBody: string): MdPut | null {
  const key = mdKeyOf(bodyKey);
  if (!key) return null;
  return {
    key,
    body: toMarkdown(sbBody),
    contentType: "text/markdown; charset=utf-8",
  };
}
