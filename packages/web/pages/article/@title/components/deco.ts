import type { Block } from "@progfay/scrapbox-parser";
import { containsEmbed } from "./embed";

/**
 * 強調 `[* x]` の段ごとの class。
 *
 * Tailwind は source の文字列を走査して class を作る。`text-deco-${n}` のように
 * 実行時に組み立てると拾われず CSS が出ないので、10 個とも完全な文字列で書く。
 * 段の font-size / line-height / font-weight は laque の token が決める。
 * `wrap-anywhere` は大きい段が狭い画面で横にはみ出さないため。
 */
const DECO_CLASSES: readonly string[] = [
  "text-deco-1-mobile md:text-deco-1 wrap-anywhere",
  "text-deco-2-mobile md:text-deco-2 wrap-anywhere",
  "text-deco-3-mobile md:text-deco-3 wrap-anywhere",
  "text-deco-4-mobile md:text-deco-4 wrap-anywhere",
  "text-deco-5-mobile md:text-deco-5 wrap-anywhere",
  "text-deco-6-mobile md:text-deco-6 wrap-anywhere",
  "text-deco-7-mobile md:text-deco-7 wrap-anywhere",
  "text-deco-8-mobile md:text-deco-8 wrap-anywhere",
  "text-deco-9-mobile md:text-deco-9 wrap-anywhere",
  "text-deco-10-mobile md:text-deco-10 wrap-anywhere",
];

/** decos (`*-N` / `/` / `-`) から `*` の段 N を返す。無ければ null。 */
export function decoLevel(decos: readonly string[]): number | null {
  for (const d of decos) {
    const m = /^\*-(\d+)$/.exec(d);
    if (m) return Number(m[1]);
  }
  return null;
}

/** 段 (1〜10) の class。範囲の外は空文字。 */
export function decoClassName(level: number): string {
  return DECO_CLASSES[level - 1] ?? "";
}

/** 広げ始める段。これ以上の強調だけの行を本文幅の外へ出す。 */
const BLEED_MIN_LEVEL = 7;

/**
 * 本文幅の外へ広げて中央に置く行か。
 * インデント 0 で、強調 1 個だけの行に限る。前後に文が付く行を広げると、
 * 文の途中で幅が変わる。インデントや引用の中は位置がずれるので広げない。
 * 埋め込みは自分で幅を持つので広げない。
 */
export function isDecoBleedLine(block: Block): boolean {
  if (block.type !== "line" || block.indent !== 0) return false;
  const [node, ...rest] = block.nodes;
  if (!node || rest.length > 0 || node.type !== "decoration") return false;
  const level = decoLevel(node.decos);
  return (
    level !== null && level >= BLEED_MIN_LEVEL && !containsEmbed(block.nodes)
  );
}
