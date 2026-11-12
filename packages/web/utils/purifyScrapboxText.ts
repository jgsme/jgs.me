import { MOTE_ORIGIN } from "@jigsaw/db/mote";

const MOTE_URL = new RegExp(
  `${MOTE_ORIGIN.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/u/[^\\s\\]]*`,
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
