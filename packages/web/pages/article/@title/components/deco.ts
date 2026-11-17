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
