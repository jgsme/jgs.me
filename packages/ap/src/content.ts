import {
  bodyFormatOf,
  htmlKeyOf,
  isTextBody,
  r2KeyOf,
} from "@jigsaw/db/body-key";
import { derivedTextLines } from "@jigsaw/db/html-article";
import { esc, scrapboxToHtml } from "./scrapbox";

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

// standard-html の .sb は HTML から作った派生テキスト。Scrapbox 記法ではないので
// parse せず、1行ずつエスケープして段落にする (括弧がリンクになるのを防ぐ)。
export function plainTextToHtml(sbBody: string): string {
  return derivedTextLines(sbBody)
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
}

// Webmention の送信先は原本の HTML から拾う。派生テキストにはリンクが
// 残らないため。原本が無ければ送らない。他の形式は描いた本文で足りる。
export async function resolveOutlinkHtml(
  bodyKey: string,
  r2: R2Bucket,
  content: string,
): Promise<string> {
  if (bodyFormatOf(bodyKey) !== "standard-html") return content;
  const key = htmlKeyOf(bodyKey);
  if (!key) return "";
  const obj = await r2.get(key);
  return obj ? await obj.text() : "";
}

// 本文は Scrapbox アーカイブ由来も Micropub 由来もすべて R2 にあり、
// どちらも Scrapbox 記法で1行目が題 (spec §6)。
// bodyKey の prefix で R2 上の入れ物 (.json / .sb) が決まる。
export async function resolveContent(
  bodyKey: string,
  r2: R2Bucket,
  siteUrl: string,
  title: string,
): Promise<string> {
  const key = r2KeyOf(bodyKey);
  if (!key) return "";

  const obj = await r2.get(key);
  if (!obj) {
    console.error(`[R2 miss] title=${title} key=${key}`);
    return "";
  }

  if (bodyFormatOf(bodyKey) === "standard-html") {
    return plainTextToHtml(await obj.text());
  }
  if (isTextBody(bodyKey)) {
    return scrapboxToHtml(await obj.text(), siteUrl);
  }

  const data = await obj.json<R2PageData>();
  return scrapboxToHtml(data.lines.map((l) => l.text).join("\n"), siteUrl);
}
