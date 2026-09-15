import { parseTarget } from "./parse.ts";

// packages/ingest/src/mf2.ts の CLIP_KINDS の写し。cli は ingest に依存して
// おらず、node で .ts を直接動かすのでワークスペース越しの import は解決が
// 面倒。4 語なので写す。片方を変えたらもう片方も変えること。
export const CLIP_KINDS = ["link", "quote", "photo", "video"] as const;
export type ClipKind = (typeof CLIP_KINDS)[number];

export type KindCommand =
  { mode: "one"; id: number; kind: ClipKind } | { mode: "csv"; path: string };

function toKind(raw: string): ClipKind | null {
  return (CLIP_KINDS as readonly string[]).includes(raw)
    ? (raw as ClipKind)
    : null;
}

export function parseKindArgs(argv: string[]): KindCommand | null {
  if (argv[0] === "--csv") {
    const path = argv[1];
    return path ? { mode: "csv", path } : null;
  }
  const [rawId, rawKind] = argv;
  if (!rawId || !rawKind) return null;
  const id = parseTarget(rawId);
  const kind = toKind(rawKind);
  return id !== null && kind !== null ? { mode: "one", id, kind } : null;
}

/**
 * CSV から pageID と kind を読む。先頭行はヘッダとして飛ばす。
 *
 * 先頭 2 列だけを見る。title は最後の列でカンマを含みうるが、先頭 2 列の
 * 位置は動かないので split の数は問題にならない。
 *
 * 同じ id が複数回あれば後の行が勝つ。手で直した行を末尾に足せる。
 */
export function parseKindCsv(text: string): {
  rows: { id: number; kind: ClipKind }[];
  errors: string[];
} {
  const lines = text.split("\n").slice(1);
  const byId = new Map<number, ClipKind>();
  const errors: string[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const [rawId, rawKind] = trimmed.split(",");
    const id = rawId ? parseTarget(rawId) : null;
    const kind = rawKind ? toKind(rawKind.trim()) : null;
    if (id === null || kind === null) {
      errors.push(`${i + 2} 行目が読めない: ${trimmed.slice(0, 60)}`);
      continue;
    }
    byId.set(id, kind);
  }
  return {
    rows: [...byId].map(([id, kind]) => ({ id, kind })),
    errors,
  };
}
