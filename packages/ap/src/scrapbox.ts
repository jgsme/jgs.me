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

const SAFE_SCHEMES = ["http:", "https:"];

// esc() は & < > " を潰すだけでスキームは見ないため、href に直接使うと
// javascript: 等が <a href="..."> にそのまま乗ってしまう。http/https だけを通す。
export function isSafeUrl(href: string): boolean {
  try {
    return SAFE_SCHEMES.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

interface Card {
  url: string;
  title?: string;
  siteName?: string;
  image?: string;
}

function safeUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  return isSafeUrl(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

// code:card ブロックの中身を Card として読む。web 側の parseCardBlock と同じ判定にすること。
// ずれると片方でカード、片方でコードブロックとして出てしまう。
function parseCardBlock(content: string): Card | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const url = safeUrl(o.url);
  if (!url) return null;

  const card: Card = { url };
  const title = str(o.title);
  if (title) card.title = title;
  const siteName = str(o.siteName);
  if (siteName) card.siteName = siteName;
  const image = safeUrl(o.image);
  if (image) card.image = image;
  return card;
}

function cardToHtml(card: Card): string {
  const img = card.image
    ? `<a href="${esc(card.url)}"><img src="${esc(card.image)}" alt=""></a>`
    : "";
  const title = esc(card.title ?? card.url);
  const siteName = card.siteName ? ` — ${esc(card.siteName)}` : "";
  return `<figure>${img}<figcaption><a href="${esc(card.url)}">${title}</a>${siteName}</figcaption></figure>`;
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
        if (!isSafeUrl(node.href)) {
          // 安全でない href はリンクにせず、本文が消えないようテキストとして残す。
          return label;
        }
        return `<a href="${esc(node.href)}">${label}</a>`;
      }
      // 内部リンクは自サイトの記事ページを指す。
      const href = `${siteUrl}/pages/${encodeURIComponent(node.href)}`;
      return `<a href="${href}">${esc(node.href)}</a>`;
    }
    case "hashTag": {
      const href = `${siteUrl}/pages/${encodeURIComponent(node.href)}`;
      return `<a href="${href}">#${esc(node.href)}</a>`;
    }
    case "image":
    case "strongImage":
      return `<img src="${esc(node.src)}" alt="">`;
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
      // icon / formula / numberList など未対応のものは生テキストで出す。
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
      if (block.fileName === "card") {
        const card = parseCardBlock(block.content);
        if (card) {
          out.push(cardToHtml(card));
          continue;
        }
      }
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
