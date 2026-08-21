import { parse, type Line, type Node } from "@progfay/scrapbox-parser";

// Mastodon v4.2 が通すタグだけを出す。
// それ以外を出しても配信時に削られるため、最初から作らない。
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeToHtml(node: Node, siteUrl: string): string {
  switch (node.type) {
    case "plain":
    case "blank":
      return esc(node.raw);
    case "code":
      return `<code>${esc(node.text)}</code>`;
    case "link": {
      if (node.pathType === "absolute") {
        const label = node.content ? esc(node.content) : esc(node.href);
        return `<a href="${esc(node.href)}">${label}</a>`;
      }
      // 内部リンクは自サイトの記事ページを指す。
      const href = `${siteUrl}/pages/${encodeURIComponent(node.href)}`;
      return `<a href="${href}">${esc(node.href)}</a>`;
    }
    case "decoration": {
      const inner = node.nodes.map((n) => nodeToHtml(n, siteUrl)).join("");
      // 強調は装飾文字が "*-1" 〜 "*-10" に正規化されるため prefix で見る。
      if (node.decos.some((d) => d.startsWith("*"))) {
        return `<strong>${inner}</strong>`;
      }
      if (node.decos.includes("/")) return `<em>${inner}</em>`;
      if (node.decos.includes("-")) return `<del>${inner}</del>`;
      return inner;
    }
    case "strong":
      return `<strong>${node.nodes.map((n) => nodeToHtml(n, siteUrl)).join("")}</strong>`;
    case "quote":
      return `<blockquote>${node.nodes.map((n) => nodeToHtml(n, siteUrl)).join("")}</blockquote>`;
    default:
      // hashTag / icon / formula など未対応のものは生テキストで出す。
      return esc(node.raw);
  }
}

function lineToHtml(line: Line, siteUrl: string): string {
  return line.nodes.map((n) => nodeToHtml(n, siteUrl)).join("");
}

export function scrapboxToHtml(text: string, siteUrl: string): string {
  if (!text.trim()) return "";

  const blocks = parse(text);
  const out: string[] = [];
  // インデント行が連続する区間を1つの ul にまとめる。
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(`<ul>${listBuffer.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    listBuffer = [];
  };

  for (const block of blocks) {
    if (block.type === "title") continue;

    if (block.type === "codeBlock") {
      flushList();
      out.push(`<pre><code>${esc(block.content)}</code></pre>`);
      continue;
    }

    if (block.type === "table") {
      flushList();
      // table は Mastodon の許可リストに無い。行をリストにして意味だけ残す。
      const rows = block.cells
        .map(
          (row) =>
            `<li>${row.map((cell) => cell.map((n) => nodeToHtml(n, siteUrl)).join("")).join(" / ")}</li>`,
        )
        .join("");
      out.push(`<ul>${rows}</ul>`);
      continue;
    }

    const html = lineToHtml(block, siteUrl);
    if (html.trim() === "") {
      flushList();
      continue;
    }

    if (block.indent > 0) {
      listBuffer.push(html);
      continue;
    }

    flushList();
    out.push(`<p>${html}</p>`);
  }

  flushList();
  return out.join("");
}
