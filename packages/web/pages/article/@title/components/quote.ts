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

/* 大きく出す引用 (short / medium) の見た目。
   罫と背景で囲うのをやめ、italic とダブルクォート (quote-marks) で引用だと示す。
   囲いは本文の中で引用を切り出すための記号だが、本文幅の外に出て 20px 以上で
   組まれた時点でそれ自体が引用だと分かるので、囲いが二重になる。

   中央寄せにするのは、1 行前後で終わる引用が左端に寄っていると右に空きができて
   据わりが悪いため。本文幅に留まる long には掛けない (行頭が揃わないと読めない)。 */
const DISPLAY_STYLE: Record<"short" | "medium", string> = {
  short: "text-5xl leading-tight italic quote-marks text-center py-6",
  medium: "text-xl italic quote-marks text-center py-4",
};

/* 本文幅に留まる引用 (clip の long と、clip でないページ) の見た目。
   地の文に混ざるので、囲いが無いと引用だと分からない。 */
const QUOTE_BASE = "bg-black/1 border-l-4 border-border-subtle";
const IN_COLUMN_STYLE = "pl-4 py-3 text-lg";

/* clip でないページの引用。従来どおり本文と同じ大きさで、余白も最小のまま。
   上下の間隔は e-content の space-y-1 が作っているので、ここでは my を付けない。 */
const ARTICLE_STYLE = "pl-1 py-1";

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
  // clip の引用は大きいので、space-y-1 の間隔だと前後の行とくっついて見える。
  // long を本文幅に留めるのは、幅を広げると 1 行が長くなりすぎて視線が戻れないため。
  if (tier === "long") {
    return `${QUOTE_BASE} my-4 ${IN_COLUMN_STYLE}`;
  }
  // 見た目は長さだけで決める。はみ出しはインデントされた行では止めるが、
  // 大きさと囲いの有無まで戻すと、同じ長さの引用がインデントの有無で別物に見える。
  const bleed = ctx.indent === 0;
  return `my-4 ${DISPLAY_STYLE[tier]}${bleed ? " quote-bleed" : ""}`;
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
