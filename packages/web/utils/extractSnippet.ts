import { purifyScrapboxText } from "./purifyScrapboxText";

type Line = { text: string };

export type ExtractSnippetOptions = {
  title: string;
  maxLength?: number;
  maxLines?: number;
};

/**
 * Scrapbox の lines 配列からスニペットを抽出する
 * - タイトル行をスキップ
 * - "from [日付]" パターンの行とタイトル重複行をスキップ
 * - タイトルと同じ行、日付ハッシュタグのみの行をスキップ
 * - Scrapbox 記法を除去してプレーンテキストを返す
 */
export function extractSnippet(
  lines: Line[],
  options: ExtractSnippetOptions
): string {
  const { title, maxLength = 200, maxLines = 10 } = options;

  let startIndex = 1;

  const firstContentLine = lines.slice(1).find((l) => l.text && l.text.trim());
  if (firstContentLine?.text.match(/^from\s+\[\d{8}\]/)) {
    startIndex = 3;
  }

  const filteredText = lines
    .slice(startIndex, startIndex + maxLines)
    .map((l) => l.text ?? "")
    .filter((t) => {
      const trimmed = t.trim();
      if (!trimmed) return false;
      if (trimmed === title) return false;
      if (/^#\d{8}$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");

  return purifyScrapboxText(filteredText).slice(0, maxLength);
}
