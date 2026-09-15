import type { Node } from "@progfay/scrapbox-parser";

/** 引用の見た目の段階。文字数の帯で、画面幅ごとの見た目は quoteClassName が決める。 */
export type QuoteTier = "short" | "medium" | "long" | "xlong";

/** 各段階の上限 (文字数)。実画面のキャプチャで決めた。
 *
 * - 50: モバイルで 48px のまま読める限度。390px だと 1 行 7〜8 字しか入らず、
 *   50 字で 6〜7 行、64 字で 8 行になって画面 1 枚を超える
 * - 100: デスクトップで 48px のまま読める限度。はみ出し幅 72rem に 1 行 24 字ほどで、
 *   100 字でも 5 行
 * - 400: デスクトップで 20px の中央寄せが読める限度。1 行 57 字ほどで、411 字で 7 行
 */
const SHORT_MAX = 50;
const MEDIUM_MAX = 100;
const LONG_MAX = 400;

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
  if (length <= LONG_MAX) return "long";
  return "xlong";
}

/* 本文幅に留まる引用 (clip の xlong と、clip でないページ) の囲い。
   地の文に混ざるので、囲いが無いと引用だと分からない。 */
const QUOTE_BASE = "bg-black/1 border-l-4 border-border-subtle";
const IN_COLUMN_STYLE = "pl-4 py-3 text-lg";

/* clip でないページの引用。従来どおり本文と同じ大きさで、余白も最小のまま。
   上下の間隔は e-content の space-y-1 が作っているので、ここでは my を付けない。 */
const ARTICLE_STYLE = "pl-1 py-1";

/* clip の引用の文字色。clip でないページの引用は地の文と同じ黒のまま。 */
const QUOTE_COLOR = "text-fg-quote";

/* 大きく出す引用の見た目。画面幅で段階がずれる:

     段階     モバイル       md 以上 (本文幅 48rem〜)
     short    48px 太字      48px 太字
     medium   20px           48px 太字
     long     本文幅・罫     20px
     xlong    本文幅・罫     本文幅・罫

   罫と背景で囲うのをやめ、italic とダブルクォート (quote-marks) で引用だと示す。
   本文幅の外に出て 20px 以上で組まれた時点でそれ自体が引用だと分かるので、囲いが二重になる。
   中央寄せにするのは、短い引用が左端に寄ると右に空きができて据わりが悪いため。

   --quote-mark-inset は開きの引用符を字に寄せる量 (index.css の quote-marks が読む)。
   光学的な詰めは字のサイズに線形比例しないので、48px と 20px で別の値を持つ。

   wrap-anywhere は、コミットハッシュや URL のような長い英数字の塊を途中で折るため。
   語の途中で折れないと、48px ではみ出し幅を突き抜ける。

   書体は short / medium だけ明朝 (font-quote)。long 以上は地の文と同じ sans のまま。
   長い引用ほど本文として読むので、書体まで変えると読みのリズムが切れる。

   md: 付きの class は Tailwind が文字列のまま拾うので、組み立てずにそのまま書くこと。
   md: の値は、1 段上の段階の値と揃えておく。 */
const DISPLAY_STYLE: Record<"short" | "medium" | "long", string> = {
  short:
    "font-quote text-5xl leading-tight font-bold italic quote-marks [--quote-mark-inset:-0.25em] text-center py-6 wrap-anywhere",
  medium:
    "font-quote text-xl italic quote-marks [--quote-mark-inset:-0.2em] text-center py-4 wrap-anywhere md:text-5xl md:leading-tight md:font-bold md:[--quote-mark-inset:-0.25em] md:py-6",
  long: "bg-black/1 border-l-4 border-border-subtle pl-4 py-3 text-lg md:bg-transparent md:border-l-0 md:pl-0 md:py-4 md:text-xl md:italic md:quote-marks md:[--quote-mark-inset:-0.2em] md:text-center md:wrap-anywhere",
};

export type QuoteContext = {
  /* 引用を大きく出すページか。呼び出し側 (+Page.tsx) が clip の kind から決める。 */
  emphasize: boolean;
  /* 行のインデント段数。はみ出しは画面中央を基準に置くので、インデントされた行では
     インデントぶんの位置を失う。横位置だけ止めて、大きさは残す。 */
  indent: number;
};

/** blockquote に付ける class を決める。 */
export function quoteClassName(node: Node, ctx: QuoteContext): string {
  if (!ctx.emphasize) {
    return `${QUOTE_BASE} ${ARTICLE_STYLE}`;
  }
  const tier = quoteTier(node);
  // clip の引用は大きいので、space-y-1 の間隔だと前後の行とくっついて見える。
  // 文字色は段階によらず fg-quote。黒のままだと 48px の太字が強すぎる。
  if (tier === "xlong") {
    return `${QUOTE_BASE} my-4 ${IN_COLUMN_STYLE} ${QUOTE_COLOR}`;
  }
  // 見た目は長さだけで決める。はみ出しはインデントされた行では止めるが、
  // 大きさと囲いの有無まで戻すと、同じ長さの引用がインデントの有無で別物に見える。
  // long がはみ出すのは md 以上だけ (モバイルは本文幅に留まる)。
  if (ctx.indent !== 0) return `my-4 ${DISPLAY_STYLE[tier]} ${QUOTE_COLOR}`;
  const bleed = tier === "long" ? "md:quote-bleed" : "quote-bleed";
  return `my-4 ${DISPLAY_STYLE[tier]} ${QUOTE_COLOR} ${bleed}`;
}
