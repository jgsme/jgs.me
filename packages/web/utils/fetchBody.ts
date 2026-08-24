import { bodyFormatOf, r2KeyOf } from "@jigsaw/db/body-key";

type R2PageData = {
  id: string;
  title: string;
  lines: { text: string }[];
};

// 戻り値は Scrapbox 記法のテキスト (1行目が題)。
export async function fetchBody(
  r2: R2Bucket,
  bodyKey: string,
  title: string,
): Promise<string | null> {
  const key = r2KeyOf(bodyKey);
  // 空文字は「本文が存在しない」。R2 を引きに行かない。
  if (!key) {
    console.error(`[R2 skip] title=${title} (no bodyKey in DB)`);
    return null;
  }

  const obj = await r2.get(key);
  if (!obj) {
    console.error(`[R2 miss] title=${title}, key=${key}`);
    return null;
  }

  if (bodyFormatOf(bodyKey) === "micropub-sb") {
    return await obj.text();
  }

  const data = await obj.json<R2PageData>();
  return data.lines.map((l) => l.text).join("\n");
}
