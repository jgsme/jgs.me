export function purifyScrapboxText(text: string): string {
  return text
    .replace(/^(code|table):.+$/gm, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\[[^\]]*\.(icon|jpg|jpeg|png|gif|svg|webp|gyazo)[^\]]*\]/gi, "")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    .replace(/\[([*/_\-!]+)\s+([^\]]+)\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/#\S+/g, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[\t ]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
