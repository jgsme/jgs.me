const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

// 配信先の本文はどこもプレーンテキスト。inline 画像もマークアップも持てない。
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<br\s*\/?>/gi, "\n")
      // リスト項目は1行ずつ並べる。段落と違って間を空けない。
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .trim()
  );
}
