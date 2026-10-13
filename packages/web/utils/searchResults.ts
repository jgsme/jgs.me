const MD_SUFFIX = ".md";

// AutoRAG が返す filename は R2 のキーそのもの。w-md のキーは <bodyKey>.md
// なので、拡張子を落とせば page.bodyKey (D1 の sbID 列) になる。
// 題は chunk の中身からではなく、この bodyKey で D1 を引いて取る。
// chunk の中身に題が入っているのは先頭 chunk だけなので、中身から取ると
// 2 個目以降の chunk に当たったページが結果から落ちる。
export function bodyKeyFromFilename(filename: string): string | null {
  if (!filename.endsWith(MD_SUFFIX)) return null;
  const bodyKey = filename.slice(0, -MD_SUFFIX.length);
  return bodyKey === "" ? null : bodyKey;
}

// max_num_results は「20 chunk」であって 20 ページではない。1 ページが
// 複数 chunk に割れると同じページが並ぶので、スコア順のまま先勝ちで潰す。
export function dedupeByBodyKey<T extends { bodyKey: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.bodyKey)) return false;
    seen.add(item.bodyKey);
    return true;
  });
}

export function snippetFromMd(md: string, maxLength = 200): string {
  const text = md
    .split("\n")
    // 先頭 chunk にだけ入っている題の行は本文ではない。
    .filter((line) => !/^#\s/.test(line))
    .map((line) => line.replace(/^\s*(?:[-*]\s+|>\s*|#{2,6}\s+)/, "").trim())
    .filter((line) => line !== "")
    .join(" ");

  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export type SearchType = "article" | "clip";

export function parseSearchType(value: string | undefined): SearchType | null {
  return value === "article" || value === "clip" ? value : null;
}

// AutoRAG の上限。種別に関わらずこの数で引いてキャッシュに置き、絞り込みの
// 切り替えでは AutoRAG を叩き直さない (server/searchHits.ts)。
export const AUTORAG_MAX_NUM_RESULTS = 50;

// 何 chunk 目までを結果に使うか。w-md のキーは種別を含まないので AutoRAG 側
// では絞れない。D1 で種別を引いて後から落とすぶん、絞り込み中は多めに使う。
export function chunksFor(type: SearchType | null): number {
  return type === null ? 20 : AUTORAG_MAX_NUM_RESULTS;
}

// article と clip の両方に登録されているページは、どちらで絞っても出す。
export function matchesSearchType(
  kinds: { isArticle: boolean; isClip: boolean },
  type: SearchType | null,
): boolean {
  if (type === null) return true;
  return type === "article" ? kinds.isArticle : kinds.isClip;
}

export function searchPath(query: string, type: SearchType | null): string {
  const params = new URLSearchParams({ q: query });
  if (type !== null) params.set("type", type);
  return `/search?${params.toString()}`;
}
