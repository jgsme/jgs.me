// Micropub の JSON 形式は全ての値が配列になる。単一値でも ["..."] で来る。
// https://www.w3.org/TR/micropub/#json-syntax
export type Entry = {
  name: string;
  content: string; // Scrapbox 記法の生テキスト
  published: string; // ISO8601 UTC。payload に無ければ空文字
  categories: string[];
  inReplyTo: string | null;
  photo: string | null;
};

type Props = Record<string, unknown>;

function firstString(props: Props, key: string): string | null {
  const v = props[key];
  if (!Array.isArray(v) || v.length === 0) return null;
  return typeof v[0] === "string" ? v[0] : null;
}

function stringList(props: Props, key: string): string[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// content は素の文字列 (Scrapbox 記法) だけを受ける。
// { html: "..." } は Micropub 的には正しい形だが、jgs.me には HTML 本文を
// 描画する経路が無い。黙って劣化させず断る。
function readContent(props: Props): string | null {
  const v = props["content"];
  if (!Array.isArray(v) || v.length === 0) return null;
  const first = v[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "html" in first) {
    throw new Error(
      "content must be plain text in Scrapbox notation, html is not accepted",
    );
  }
  return null;
}

export function parseEntry(payload: unknown): Entry {
  if (!payload || typeof payload !== "object") {
    throw new Error("properties is required");
  }
  const p = payload as { type?: unknown; properties?: unknown };

  if (!p.properties || typeof p.properties !== "object") {
    throw new Error("properties is required");
  }
  if (!Array.isArray(p.type) || p.type[0] !== "h-entry") {
    throw new Error("type must be h-entry");
  }

  const props = p.properties as Props;

  const name = firstString(props, "name");
  if (!name) throw new Error("name is required");

  const content = readContent(props);
  if (content === null) throw new Error("content is required");

  const rawPublished = firstString(props, "published");
  let published = "";
  if (rawPublished) {
    const d = new Date(rawPublished);
    if (Number.isNaN(d.getTime())) {
      throw new Error("published is not a valid date");
    }
    published = d.toISOString();
  }

  return {
    name,
    content,
    published,
    categories: stringList(props, "category"),
    inReplyTo: firstString(props, "in-reply-to"),
    photo: firstString(props, "photo"),
  };
}

// clip か記事かは category で決める。IndieWeb の bookmark post type に
// 倣って bookmark-of の有無で判別する案もあったが、それだと URL を持たない
// メモや写真の clip を判別できない。category なら 1 ルールで全部を覆える。
export const CLIP_CATEGORY = "clip";

export function isClip(categories: readonly string[]): boolean {
  return categories.includes(CLIP_CATEGORY);
}
