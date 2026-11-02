import { htmlKeyOf, isTextBody, r2KeyOf, renderKeyOf } from "./bodyKey";
import {
  parseRenderedHtmlArticle,
  type RenderedHtmlArticle,
} from "./htmlArticle";

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

  if (isTextBody(bodyKey)) {
    return await obj.text();
  }

  const data = await obj.json<R2PageData>();
  return data.lines.map((l) => l.text).join("\n");
}

// standard-html の原本 HTML。html 形式でなければ R2 を引かずに null。
export async function fetchHtmlBody(
  r2: R2Bucket,
  bodyKey: string,
): Promise<string | null> {
  const key = htmlKeyOf(bodyKey);
  if (!key) return null;
  const obj = await r2.get(key);
  if (!obj) {
    console.error(`[R2 miss] key=${key}`);
    return null;
  }
  return await obj.text();
}

// standard-html の組み直し済み表示用。形が違えば null (読み側が原本から
// 組み直せるように、壊れた JSON は無いものとして扱う)。
export async function fetchRenderedHtml(
  r2: R2Bucket,
  bodyKey: string,
): Promise<RenderedHtmlArticle | null> {
  const key = renderKeyOf(bodyKey);
  if (!key) return null;
  const obj = await r2.get(key);
  if (!obj) {
    console.error(`[R2 miss] key=${key}`);
    return null;
  }
  return parseRenderedHtmlArticle(await obj.json<unknown>());
}
