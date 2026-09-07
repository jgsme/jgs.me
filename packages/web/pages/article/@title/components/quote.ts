import type { Node } from "@progfay/scrapbox-parser";

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
