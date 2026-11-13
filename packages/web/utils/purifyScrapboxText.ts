import { MOTE_ORIGIN } from "@jigsaw/db/mote";

// 埋め込みになる mote のページ URL (/u/<actor>/<rkey>) だけを落とす。
// rkey は TID の形 (13 文字) で区切り、後ろに続く本文は残す。ホストは
// 大文字小文字を問わない (parseMoteUrl と同じ)。
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const anyCase = (t: string) =>
  [...t]
    .map((c) =>
      c.toLowerCase() !== c.toUpperCase()
        ? `[${c.toLowerCase()}${c.toUpperCase()}]`
        : escape(c),
    )
    .join("");
const MOTE_URL = new RegExp(
  `https://${anyCase(new URL(MOTE_ORIGIN).host)}/u/[A-Za-z0-9.:_%-]+/` +
    "[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}" +
    "(?:/(?:[?#][^\\s\\]]*)?|[?#][^\\s\\]]*)?",
  "g",
);

export function purifyScrapboxText(text: string): string {
  return text
    .replace(/^(code|table):.+$/gm, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\[[^\]]*\.(icon|jpg|jpeg|png|gif|svg|webp|gyazo)[^\]]*\]/gi, "")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    .replace(MOTE_URL, "")
    .replace(/\[([*/_\-!]+)\s+([^\]]+)\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/#\S+/g, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[\t ]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
