// clip を Margin の at.margin.note に写す変換。
// 入力は fetchBody() の出力 (1行目が題の Scrapbox 記法)。
// 本文の出典の書き方は年代でばらばらなので、拾えなかった clip は skip で返して人が見る。
import {
  parse,
  type Block,
  type Line,
  type Node,
} from "@progfay/scrapbox-parser";
import { pagePath } from "@jigsaw/db/page-path";

export type ClipNoteInput = {
  readonly title: string;
  // page.created。D1 の CURRENT_TIMESTAMP 形式 ("YYYY-MM-DD HH:MM:SS"、UTC)。
  readonly created: string;
  readonly body: string;
};

export type MarginNote = {
  readonly $type: "at.margin.note";
  readonly motivation: "highlighting" | "commenting" | "bookmarking";
  readonly target: {
    readonly source: string;
    readonly sourceHash: string;
    readonly title: string;
    readonly selector?: {
      readonly type: "TextQuoteSelector";
      readonly exact: string;
    };
  };
  readonly body?: { readonly value: string; readonly format: "text/plain" };
  readonly tags?: readonly string[];
  readonly createdAt: string;
};

export type ClipNoteResult = {
  readonly note: MarginNote;
  readonly warnings: readonly string[];
};

// 自サイトの画像と記事は clip の出典ではない (diary の clip-import と同じ規則)。
const SKIP_HOSTS: ReadonlySet<string> = new Set([
  "r2.jgs.me",
  "w.jgs.me",
  "gyazo.com",
  "i.gyazo.com",
]);

const SCRAPBOX_ORIGIN = "https://scrapbox.io";
const SITE_URL = "https://w.jgs.me";

// lexicon の上限。
const BODY_MAX = 3000;
const EXACT_MAX = 1500;
const TAGS_MAX = 10;
const TAG_MAX = 32;
const TITLE_MAX = 500;
const HEX_RADIX = 16;
const HEX_WIDTH = 2;

type Collect = { readonly tags: string[] };

const isBlankPlain = (n: Node): boolean =>
  n.type === "plain" && n.text.trim() === "";

const solidNodes = (line: Line): readonly Node[] =>
  line.nodes.filter((n) => !isBlankPlain(n));

function sourceUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const web = u.protocol === "http:" || u.protocol === "https:";
    return web && !SKIP_HOSTS.has(u.hostname) ? href : null;
  } catch {
    return null;
  }
}

function cardUrl(content: string): string | null {
  try {
    const o: unknown = JSON.parse(content.trim());
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const url = (o as Record<string, unknown>).url;
    return typeof url === "string" ? sourceUrl(url) : null;
  } catch {
    return null;
  }
}

const children = (nodes: readonly Node[], c: Collect): string =>
  nodes.map((n) => nodeText(n, c)).join("");

const NODE_TEXT: {
  readonly [K in Node["type"]]: (
    n: Extract<Node, { type: K }>,
    c: Collect,
  ) => string;
} = {
  plain: (n) => n.text,
  blank: (n) => n.text,
  decoration: (n, c) => children(n.nodes, c),
  strong: (n, c) => children(n.nodes, c),
  quote: (n, c) => children(n.nodes, c),
  numberList: (n, c) => `${n.rawNumber}${children(n.nodes, c)}`,
  code: (n) => n.text,
  commandLine: (n) => `${n.symbol} ${n.text}`,
  helpfeel: (n) => `? ${n.text}`,
  formula: (n) => n.formula,
  link: (n) => (n.pathType === "absolute" ? n.content || n.href : n.href),
  hashTag: (n, c) => {
    c.tags.push(n.href);
    return `#${n.href}`;
  },
  // 画像・アイコン・地図は置く場所が無いので落とす。
  image: () => "",
  strongImage: () => "",
  icon: () => "",
  strongIcon: () => "",
  googleMap: () => "",
};

function nodeText(n: Node, c: Collect): string {
  const f = NODE_TEXT[n.type] as (n: Node, c: Collect) => string;
  return f(n, c);
}

// 行が出典リンク 1 つだけでできているか ([題 URL] / [URL 題] / [URL] / [/project/page])。
function isSourceOnlyLine(line: Line, url: string): boolean {
  const nodes = solidNodes(line);
  const only = nodes[0];
  return nodes.length === 1 && only !== undefined && linkSource(only) === url;
}

const MEDIA_TYPES: ReadonlySet<Node["type"]> = new Set([
  "image",
  "strongImage",
  "icon",
  "strongIcon",
]);

function isMediaOnlyLine(line: Line): boolean {
  const nodes = solidNodes(line);
  return nodes.length > 0 && nodes.every((n) => MEDIA_TYPES.has(n.type));
}

const isTagNode = (n: Node): boolean =>
  n.type === "hashTag" || (n.type === "link" && n.pathType === "relative");

// ハッシュタグと内部リンクだけの行は Scrapbox でのタグ付け。本文には入れず tags にする。
function isTagOnlyLine(line: Line): boolean {
  const nodes = solidNodes(line);
  return nodes.length > 0 && nodes.every(isTagNode);
}

function tagOf(n: Node): readonly string[] {
  return isTagNode(n) && "href" in n ? [n.href] : [];
}

const isQuoteLine = (line: Line): boolean => line.nodes[0]?.type === "quote";

const NESTED_TYPES: ReadonlySet<Node["type"]> = new Set([
  "quote",
  "decoration",
  "strong",
]);

function linksOf(n: Node): readonly Node[] {
  if (n.type === "link") return [n];
  if (NESTED_TYPES.has(n.type) && "nodes" in n) return n.nodes.flatMap(linksOf);
  return [];
}

// [/project/page] は他の Scrapbox project のページ。
function scrapboxUrl(href: string): string {
  return `${SCRAPBOX_ORIGIN}${href.split("/").map(encodeURIComponent).join("/")}`;
}

function linkSource(n: Node): string | null {
  if (n.type !== "link") return null;
  if (n.pathType === "absolute") return sourceUrl(n.href);
  if (n.pathType === "root") return scrapboxUrl(n.href);
  return null;
}

function findSource(blocks: readonly Block[]): string | null {
  const fromCard = blocks
    .map((b) =>
      b.type === "codeBlock" && b.fileName === "card"
        ? cardUrl(b.content)
        : null,
    )
    .find((u) => u !== null);
  if (fromCard) return fromCard;

  const fromLink = blocks
    .flatMap((b) => (b.type === "line" ? b.nodes.flatMap(linksOf) : []))
    .map(linkSource)
    .find((u) => u !== null);
  return fromLink ?? null;
}

// Margin の HashURL と同じ正規化 (scheme を落とし、host を小文字にして先頭の www. を落とし、
// デコード済みの path と生の query を繋げて末尾の / を落とす)。
export function normalizeForHash(url: string): string {
  const u = new URL(url);
  const lower = u.host.toLowerCase();
  const host = lower.startsWith("www.") ? lower.slice("www.".length) : lower;
  const path = safeDecode(u.pathname);
  const query = u.search.length > 1 ? u.search : "";
  const s = `${host}${path}${query}`;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function sourceHash(url: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeForHash(url));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_WIDTH, "0"))
    .join("");
}

export function toIsoDatetime(created: string): string {
  // D1 の CURRENT_TIMESTAMP は区切りが空白でタイムゾーンが無い (UTC)。
  const s = created.includes("T") ? created : `${created.replace(" ", "T")}Z`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`created を読めない: ${created}`);
  }
  return d.toISOString();
}

function truncate(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("")}…`;
}

type Walk = {
  readonly title: string;
  readonly quotes: readonly (readonly string[])[];
  readonly inQuote: boolean;
  readonly out: readonly string[];
  readonly warnings: readonly string[];
};

function stepLine(w: Walk, b: Line, source: string, c: Collect): Walk {
  if (isSourceOnlyLine(b, source)) return w;
  // 画像は置く場所が無い。ほぼ全部が unfurl のサムネなので warn にもしない。
  if (isMediaOnlyLine(b)) return { ...w, inQuote: false };
  if (isTagOnlyLine(b)) {
    c.tags.push(...b.nodes.flatMap(tagOf));
    return w;
  }

  const text = children(b.nodes, c).trim();
  // 1行目の題のあとにもう一度題が入っている clip がある。
  if (text === w.title) return w;

  if (isQuoteLine(b) && text !== "") {
    const quotes = w.inQuote
      ? [...w.quotes.slice(0, -1), [...(w.quotes.at(-1) ?? []), text]]
      : [...w.quotes, [text]];
    // 2つ目以降の引用は selector に入らないので本文に残す。
    const out = quotes.length > 1 ? [...w.out, `> ${text}`] : w.out;
    return { ...w, quotes, out, inQuote: true };
  }

  const indented =
    b.indent > 0 && text !== ""
      ? `${"  ".repeat(b.indent - 1)}- ${text}`
      : text;
  return { ...w, inQuote: false, out: [...w.out, indented] };
}

function step(w: Walk, b: Block, source: string, c: Collect): Walk {
  if (b.type === "title") return { ...w, title: b.text.trim() || w.title };
  if (b.type === "codeBlock") {
    const out = b.fileName === "card" ? w.out : [...w.out, b.content];
    return { ...w, inQuote: false, out };
  }
  if (b.type === "table") {
    return { ...w, inQuote: false, warnings: [...w.warnings, "表を落とした"] };
  }
  return stepLine(w, b, source, c);
}

// 空行の連続を 1 行に詰める。
function squeezeBlank(lines: readonly string[]): readonly string[] {
  return lines.filter(
    (l, i) => l.trim() !== "" || (lines[i - 1] ?? "").trim() !== "",
  );
}

function motivationOf(
  exact: string | undefined,
  body: string,
): MarginNote["motivation"] {
  if (!exact) return "bookmarking";
  return body ? "commenting" : "highlighting";
}

function pickTags(raw: readonly string[]): readonly string[] {
  const uniq = [...new Set(raw.map((t) => t.trim()).filter((t) => t !== ""))];
  return uniq.filter((t) => [...t].length <= TAG_MAX).slice(0, TAGS_MAX);
}

export async function buildClipNote(
  input: ClipNoteInput,
): Promise<ClipNoteResult> {
  const blocks = parse(input.body);
  // 出典の無い clip (メモやスクショだけのもの) は jgs.me の自分のページを target にする。
  const found = findSource(blocks);
  const source = found ?? `${SITE_URL}${pagePath(input.title)}`;

  const c: Collect = { tags: [] };
  const init: Walk = {
    title: input.title,
    quotes: [],
    inQuote: false,
    out: [],
    warnings: [],
  };
  const w = blocks.reduce((acc, b) => step(acc, b, source, c), init);

  const bodyText = squeezeBlank(w.out).join("\n").trim();
  const exact = w.quotes[0]?.join("\n");
  const tags = pickTags(c.tags);

  const warnings = [
    ...w.warnings,
    ...(found ? [] : ["出典が無いので jgs.me のページを target にした"]),
    ...(tags.length < new Set(c.tags).size ? ["タグを間引いた"] : []),
    ...(exact && [...exact].length > EXACT_MAX ? ["引用を切り詰めた"] : []),
    ...([...bodyText].length > BODY_MAX ? ["本文を切り詰めた"] : []),
  ];

  const note: MarginNote = {
    $type: "at.margin.note",
    motivation: motivationOf(exact, bodyText),
    target: {
      source,
      sourceHash: await sourceHash(source),
      title: truncate(w.title, TITLE_MAX),
      ...(exact
        ? {
            selector: {
              type: "TextQuoteSelector",
              exact: truncate(exact, EXACT_MAX),
            },
          }
        : {}),
    },
    ...(bodyText
      ? { body: { value: truncate(bodyText, BODY_MAX), format: "text/plain" } }
      : {}),
    ...(tags.length > 0 ? { tags } : {}),
    createdAt: toIsoDatetime(input.created),
  };

  return { note, warnings: [...new Set(warnings)] };
}
