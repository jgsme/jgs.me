import { bodyFormatOf, r2KeyOf } from "@jigsaw/db/body-key";
import { scrapboxToHtml } from "./scrapbox";

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

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

  if (bodyFormatOf(bodyKey) === "micropub-sb") {
    return scrapboxToHtml(await obj.text(), siteUrl);
  }

  const data = await obj.json<R2PageData>();
  return scrapboxToHtml(data.lines.map((l) => l.text).join("\n"), siteUrl);
}
