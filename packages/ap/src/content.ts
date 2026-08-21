import { isMicropubBodyKey, r2KeyOf } from "@jigsaw/db/body-key";
import { scrapboxToHtml } from "./scrapbox";

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

// 本文は Scrapbox 由来も diary 由来もすべて R2 にある (spec §6)。
// bodyKey の prefix で中身の形式が決まる。
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

  if (isMicropubBodyKey(bodyKey)) {
    // Micropub 投入時にサニタイズ済み (計画2 Task 2)。
    return await obj.text();
  }

  const data = await obj.json<R2PageData>();
  return scrapboxToHtml(data.lines.map((l) => l.text).join("\n"), siteUrl);
}
