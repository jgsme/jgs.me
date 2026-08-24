export interface Card {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  imageSource?: string;
}

function safeUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * code:card ブロックの中身を Card として読む。
 * 読めなければ null を返し、呼び出し側は普通のコードブロックとして描く。
 * 手で書き換えて壊したときに本文が消えるのを避ける。
 */
export function parseCardBlock(content: string): Card | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const url = safeUrl(o.url);
  if (!url) return null;

  const card: Card = { url };
  const title = str(o.title);
  if (title) card.title = title;
  const description = str(o.description);
  if (description) card.description = description;
  const siteName = str(o.siteName);
  if (siteName) card.siteName = siteName;
  const image = safeUrl(o.image);
  if (image) card.image = image;
  const imageSource = safeUrl(o.imageSource);
  if (imageSource) card.imageSource = imageSource;
  return card;
}
