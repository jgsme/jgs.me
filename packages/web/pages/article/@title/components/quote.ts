import type { Block, Node } from "@progfay/scrapbox-parser";

/** 引用の見た目の段階。short ほど大きく出す。 */
export type QuoteTier = "short" | "medium" | "long";

/** short と medium の上限 (文字数)。直近の clip 300 件の実測分布の p25 / p75。 */
const SHORT_MAX = 30;
const MEDIUM_MAX = 100;

/**
 * node が画面に出す文字を連結する。
 *
 * 長さで見た目を決めるので、数えるのは「読者の目に入る文字」だけ。link の href や
 * decoration の記法は raw に含まれるが表示されないので、raw ではなく node の中身を
 * 辿る。
 */
export function quoteText(node: Node): string {
  return collect(node).trim();
}

function collect(node: Node): string {
  // 子を持つ node (quote / strong / decoration / numberList) は中を辿る。
  if ("nodes" in node) {
    return node.nodes.map(collect).join("");
  }
  // link は表示される側だけ数える。content が空なら href が表示される。
  if (node.type === "link") {
    return node.content || node.href;
  }
  if (node.type === "hashTag") {
    return node.href;
  }
  if (node.type === "icon" || node.type === "strongIcon") {
    return node.path;
  }
  // plain / code / commandLine / blank / helpfeel。
  if ("text" in node) {
    return node.text;
  }
  // image / strongImage / formula / googleMap は文字を持たない。
  return "";
}

/**
 * 引用の長さから見た目の段階を決める。
 *
 * Array.from で数えるのは、String.length が UTF-16 単位で、サロゲートペア
 * (絵文字や一部の漢字) を 2 文字と数えてしまうため。境界のすぐ手前の引用が
 * 1 段落ちる。
 */
export function quoteTier(node: Node): QuoteTier {
  const length = Array.from(quoteText(node)).length;
  if (length <= SHORT_MAX) return "short";
  if (length <= MEDIUM_MAX) return "medium";
  return "long";
}

/* clip の引用の見た目。tier ごとに文字の大きさと余白を振る。 */
const CLIP_STYLE: Record<QuoteTier, string> = {
  short: "text-5xl leading-tight pl-8 py-6",
  medium: "text-xl pl-4 py-3",
  long: "text-lg pl-4 py-3",
};

/* clip でないページの引用。従来どおり本文と同じ大きさで、余白も最小のまま。
   上下の間隔は e-content の space-y-1 が作っているので、ここでは my を付けない。 */
const ARTICLE_STYLE = "pl-1 py-1";

/* 罫と背景。clip かどうかに関係なく「これは引用」を示す。 */
const QUOTE_BASE = "bg-black/1 border-l-4 border-border-subtle";

/* はみ出させない tier。long は幅を広げると 1 行が長くなりすぎて視線が戻れない。 */
const IN_COLUMN: QuoteTier[] = ["long"];

export type QuoteContext = {
  /* clip のページか。clip は引用が本体なので大きく出すが、普通の記事の引用は
     地の文の一部なので大きくすると本文の流れが切れる。 */
  isClip: boolean;
  /* 行のインデント段数。はみ出しは画面中央を基準に置くので、インデントされた行では
     インデントぶんの位置を失う。横位置だけ止めて、大きさは残す。 */
  indent: number;
};

/** blockquote に付ける class を決める。 */
export function quoteClassName(node: Node, ctx: QuoteContext): string {
  if (!ctx.isClip) {
    return `${QUOTE_BASE} ${ARTICLE_STYLE}`;
  }
  const tier = quoteTier(node);
  const bleed = !IN_COLUMN.includes(tier) && ctx.indent === 0;
  // clip の引用は大きいので、space-y-1 の間隔だと前後の行とくっついて見える。
  return `${QUOTE_BASE} my-4 ${CLIP_STYLE[tier]}${bleed ? " quote-bleed" : ""}`;
}

/* 空白を落とす。引用側にだけ改行や全角空白が入っていることがあり、
   そのままだと同じ文なのに一致しない。 */
function squash(s: string): string {
  return s.replace(/\s+/gu, "");
}

/**
 * 記事の題が本文の引用と同じものを指しているか。
 *
 * clip は引用をそのまま題にすることが多く、そのとき題と引用が同じ文を二度出す。
 * 一致ではなく「引用が題で始まる」を見るのは、題が引用を途中で切り詰めた形の
 * ページが実在するため (完全一致だけだと取りこぼす)。
 *
 * 逆向き (題が引用より長い) は見ない。実データに無いうえ、題に元記事のタイトルや
 * サイト名が足されているだけのページを巻き込む。
 */
export function isTitleQuoted(blocks: Block[], title: string): boolean {
  const t = squash(title);
  // startsWith("") は常に true。ガードが無いと引用のある clip が全部該当する。
  if (t === "") return false;
  return blocks.some(
    (b) =>
      b.type === "line" &&
      b.nodes.some((n) => n.type === "quote" && squash(quoteText(n)).startsWith(t)),
  );
}
