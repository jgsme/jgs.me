// HTML article の単体 HTML を、jgs.me の記事ページの中に描ける形に組み直す。
// 道具は htmlparser2 系 (純 JS)。ingest は nodejs_compat を付けておらず、
// HTMLRewriter は node の vitest で動かないので使わない。
import {
  HTML_ARTICLE_CLASS,
  RENDER_VERSION,
  type HeadLink,
  type HeadStyle,
  type RenderedHtmlArticle,
} from "@jigsaw/db/html-article";
import { render } from "dom-serializer";
import { Element, isTag, isText, type ChildNode } from "domhandler";
import { findAll, findOne } from "domutils";
import { parseDocument } from "htmlparser2";
import { scopeCss } from "./scopeCss";

const SCOPE = "." + HTML_ARTICLE_CLASS;

const LINK_RELS = ["stylesheet", "preconnect"] as const;

// <link> の属性のうち HeadLink が持つ欄。キーは HeadLink 側の名前
const LINK_ATTRS = [
  ["crossorigin", "crossOrigin"],
  ["media", "media"],
  ["type", "type"],
  ["integrity", "integrity"],
  ["referrerpolicy", "referrerPolicy"],
] as const;

function toHeadLink(el: Element): HeadLink | null {
  const href = el.attribs.href;
  if (href === undefined) return null;
  // rel は空白区切りの複数語がありうる。対象の語のうち最初に当たった方を採る
  const rel = (el.attribs.rel ?? "")
    .toLowerCase()
    .split(/\s+/)
    .find((t): t is (typeof LINK_RELS)[number] =>
      (LINK_RELS as readonly string[]).includes(t),
    );
  if (rel === undefined) return null;
  const link: HeadLink = { rel, href };
  for (const [attr, key] of LINK_ATTRS) {
    const v = el.attribs[attr];
    if (v !== undefined) link[key] = v;
  }
  return link;
}

function textOf(el: Element): string {
  return el.children
    .filter(isText)
    .map((t) => t.data)
    .join("");
}

const isNamed =
  (name: string) =>
  (e: Element): boolean =>
    e.name === name;

// noscript / template の中は描画に使われない (または別文書) ので、持ち上げない
function insideInert(el: Element): boolean {
  for (let p = el.parent; p; p = p.parent) {
    if (isTag(p) && (p.name === "noscript" || p.name === "template"))
      return true;
  }
  return false;
}

function remove(el: Element): void {
  el.parent?.children.splice(el.parent.children.indexOf(el), 1);
}

// n の後ろの兄弟。ブラウザは </body> の後ろの内容を body に入れるので、それに倣う
function siblingsAfter(n: ChildNode): ChildNode[] {
  const sibs = n.parent?.children ?? [];
  return sibs.slice(sibs.indexOf(n) + 1);
}

// style 属性の断片を繋ぐ。前が ; で終わっていなければ ; を挟む
function joinStyles(parts: string[]): string {
  let out = "";
  for (const p of parts) {
    if (p.trim() === "") continue;
    out += out === "" || out.endsWith(";") ? p : ";" + p;
  }
  return out;
}

export function renderHtmlArticle(
  html: string,
  opts: { colorScheme: string | null },
): RenderedHtmlArticle {
  const doc = parseDocument(html);
  const htmlEl = findOne(isNamed("html"), doc.children);
  const headEl = findOne(isNamed("head"), doc.children);
  const bodyEl = findOne(isNamed("body"), doc.children);

  // head の script は body の先頭へ回す (取り除く前に集める)
  const headScripts = headEl ? findAll(isNamed("script"), headEl.children) : [];

  // style / link は head でも body でも文書順に集め、本文からは取り除く。
  // head が無い文書でも持ち上がるよう、木全体から探す
  const styleEls = findAll(isNamed("style"), doc.children).filter(
    (e) => !insideInert(e),
  );
  const styles: HeadStyle[] = styleEls.map((s) => ({
    css: scopeCss(textOf(s), SCOPE),
    media: s.attribs.media ?? null,
  }));
  const linkEls = findAll(isNamed("link"), doc.children).filter(
    (e) => !insideInert(e),
  );
  const links: HeadLink[] = [];
  const hoisted = [...styleEls];
  for (const l of linkEls) {
    const link = toHeadLink(l);
    if (!link) continue;
    links.push(link);
    hoisted.push(l);
  }
  hoisted.forEach(remove);

  // 本文: body があればその子と、</body> 以降の内容。
  // 無ければ html の head 以外、それも無ければ head 以外の断片そのもの
  const isStructure = (n: ChildNode) =>
    n.type === "directive" ||
    n === headEl ||
    (isTag(n) && (n.name === "html" || n.name === "body"));
  const source = bodyEl
    ? [
        ...bodyEl.children,
        ...siblingsAfter(bodyEl),
        ...(bodyEl.parent === htmlEl && htmlEl ? siblingsAfter(htmlEl) : []),
      ]
    : htmlEl
      ? htmlEl.children
      : doc.children;
  const content = source.filter(
    (n) => !isStructure(n) && !headScripts.includes(n as Element),
  );

  const classes = [
    HTML_ARTICLE_CLASS,
    ...[htmlEl?.attribs.class, bodyEl?.attribs.class]
      .flatMap((c) => (c ?? "").split(/\s+/))
      .filter((c) => c !== ""),
  ];
  const attribs: Record<string, string> = { class: classes.join(" ") };
  const lang = htmlEl?.attribs.lang;
  if (lang !== undefined) attribs.lang = lang;
  const dir = bodyEl?.attribs.dir ?? htmlEl?.attribs.dir;
  if (dir !== undefined) attribs.dir = dir;
  const style = joinStyles([
    opts.colorScheme ? `color-scheme: ${opts.colorScheme};` : "",
    htmlEl?.attribs.style ?? "",
    bodyEl?.attribs.style ?? "",
  ]);
  if (style !== "") attribs.style = style;

  const container = new Element("div", attribs, [...headScripts, ...content]);
  return {
    version: RENDER_VERSION,
    head: { links, styles },
    body: render(container, { encodeEntities: "utf8" }),
  };
}

// 文書順で最初の <img src> のうち、https の絶対 URL
export function firstHttpsImage(html: string): string | null {
  for (const img of findAll(
    (e) => e.name === "img",
    parseDocument(html).children,
  )) {
    const src = img.attribs.src?.trim();
    if (!src) continue;
    try {
      if (new URL(src).protocol === "https:") return src;
    } catch {
      // 相対 URL など。次へ
    }
  }
  return null;
}
