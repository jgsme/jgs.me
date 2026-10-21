import type { Env } from "./index";

export type CrawlMeta = {
  readonly url: string;
  readonly finalUrl: string;
  readonly redirected: boolean;
  readonly status: number;
  readonly contentType: string;
  readonly title: string;
  readonly textLength: number;
  readonly contentHash: string;
  readonly fetchedAt: string;
  readonly skip?: string;
};

export type FetchedPage = {
  readonly status: number;
  readonly finalUrl: string;
  readonly contentType: string;
  readonly bytes: ArrayBuffer | null;
  readonly skip?: string;
};

export type CrawlDeps = {
  readonly fetchPage: (url: string) => Promise<FetchedPage>;
  readonly toMarkdown: (
    bytes: ArrayBuffer,
    mimeType: string,
    url: string,
  ) => Promise<string>;
  readonly readMeta: (key: string) => Promise<CrawlMeta | null>;
  readonly write: (
    key: string,
    files: {
      readonly raw: ArrayBuffer | null;
      readonly md: string | null;
      readonly meta: CrawlMeta;
    },
  ) => Promise<void>;
  readonly now: () => Date;
};

const DAY_MS = 86_400_000;
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * DAY_MS;
export const MAX_BYTES = 5_242_880;
const HEX_RADIX = 16;
const HEX_WIDTH = 2;
const HTTP_OK_MIN = 200;
const HTTP_OK_END = 300;

export function normalizeUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  [...u.searchParams.keys()]
    .filter((k) => k.toLowerCase().startsWith("utm_"))
    .forEach((k) => u.searchParams.delete(k));
  return u.toString();
}

export async function crawlKey(normalized: string): Promise<string> {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized)),
  );
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_WIDTH, "0"))
    .join("");
}

export function mimeKind(contentType: string): "html" | "pdf" | null {
  const t = contentType.split(";")[0]!.trim().toLowerCase();
  if (t === "text/html" || t === "application/xhtml+xml") return "html";
  if (t === "application/pdf") return "pdf";
  return null;
}

// 先頭の YAML frontmatter。"---\ntitle: a\n---\n本文" に当たり、"本文\n---" には当たらない。
// https://regex101.com/?regex=%5E---%5Cn%28%5B%5Cs%5CS%5D%2A%3F%29%5Cn---%5Cn%3F&flags=&testString=---%0Atitle%3A+a%0A---%0A%E6%9C%AC%E6%96%87&flavor=javascript
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
// frontmatter 内の title 行。"title: 題" に当たり、"subtitle: 題" には当たらない。
// https://regex101.com/?regex=%5Etitle%3A%5Cs%2A%28.%2A%29%24&flags=m&testString=title%3A+%E9%A1%8C%0Asubtitle%3A+%E9%A1%8C&flavor=javascript
const TITLE_LINE = /^title:\s*(.*)$/m;
// 値を囲む引用符。'"題"' の両端に当たり、"題" には当たらない。
// https://regex101.com/?regex=%5E%5B%22%27%5D%7C%5B%22%27%5D%24&flags=g&testString=%22%E9%A1%8C%22&flavor=javascript
const QUOTES = /^["']|["']$/g;
// markdown 画像。"![alt](https://x/a.png)" に当たり、"[a](https://x)" には当たらない。
// https://regex101.com/?regex=%21%5C%5B%5B%5E%5C%5D%5D%2A%5C%5D%5C%28%5B%5E%29%5D%2A%5C%29&flags=g&testString=%21%5Balt%5D%28https%3A%2F%2Fx%2Fa.png%29+%5Ba%5D%28https%3A%2F%2Fx%29&flavor=javascript
const MD_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
// markdown リンク。"[a](https://x)" に当たり、"[a]" だけには当たらない。
// https://regex101.com/?regex=%5C%5B%28%5B%5E%5C%5D%5D%2A%29%5C%5D%5C%28%5B%5E%29%5D%2A%5C%29&flags=g&testString=%5Ba%5D%28https%3A%2F%2Fx%29+%5Ba%5D&flavor=javascript
const MD_LINK = /\[([^\]]*)\]\([^)]*\)/g;
// 空白類。" \n\t" に当たり、"a" には当たらない。
// https://regex101.com/?regex=%5Cs%2B&flags=g&testString=a+%0A%09b&flavor=javascript
const SPACES = /\s+/g;

export function frontmatterTitle(md: string): string {
  const line = md.match(FRONTMATTER)?.[1]?.match(TITLE_LINE);
  return line?.[1]?.trim().replace(QUOTES, "") ?? "";
}

// clef に渡す時の文字数の目安。リンク先 URL と画像は数えない。
export function plainLength(md: string): number {
  return md
    .replace(FRONTMATTER, "")
    .replace(MD_IMAGE, "")
    .replace(MD_LINK, "$1")
    .replace(SPACES, "").length;
}

export async function runCrawl(
  deps: CrawlDeps,
  url: string,
  force: boolean,
): Promise<CrawlMeta> {
  const key = await crawlKey(url);
  const now = deps.now();
  if (!force) {
    const cached = await deps.readMeta(key);
    if (
      cached &&
      now.getTime() - new Date(cached.fetchedAt).getTime() < TTL_MS
    ) {
      return cached;
    }
  }

  const page = await deps.fetchPage(url);
  const finalUrl = normalizeUrl(page.finalUrl) ?? page.finalUrl;
  const base = {
    url,
    finalUrl,
    redirected: finalUrl !== url,
    status: page.status,
    contentType: page.contentType,
    fetchedAt: now.toISOString(),
  };
  const empty = { title: "", textLength: 0, contentHash: "" };

  const kind = mimeKind(page.contentType);
  let skip = page.skip;
  if (!skip && (page.status < HTTP_OK_MIN || page.status >= HTTP_OK_END)) {
    skip = `status ${page.status}`;
  }
  if (!skip && !kind) skip = `unsupported content-type: ${page.contentType}`;
  if (skip || !page.bytes || !kind) {
    const meta: CrawlMeta = { ...base, ...empty, skip: skip ?? "empty body" };
    await deps.write(key, { raw: null, md: null, meta });
    return meta;
  }

  let md: string;
  try {
    md = await deps.toMarkdown(
      page.bytes,
      kind === "html" ? "text/html" : "application/pdf",
      finalUrl,
    );
  } catch (e) {
    const meta: CrawlMeta = {
      ...base,
      ...empty,
      skip: `toMarkdown: ${e instanceof Error ? e.message : String(e)}`,
    };
    await deps.write(key, { raw: page.bytes, md: null, meta });
    return meta;
  }

  const meta: CrawlMeta = {
    ...base,
    title: frontmatterTitle(md),
    textLength: plainLength(md),
    contentHash: hex(await crypto.subtle.digest("SHA-256", page.bytes)),
  };
  await deps.write(key, { raw: page.bytes, md, meta });
  return meta;
}

const FETCH_TIMEOUT_MS = 10_000;

async function readCapped(res: Response): Promise<ArrayBuffer | null> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES || !res.body) {
    await res.body?.cancel();
    return null;
  }
  const chunks = await drain(res.body.getReader(), [], 0);
  if (!chunks) return null;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  chunks.reduce((off, c) => {
    out.set(c, off);
    return off + c.byteLength;
  }, 0);
  return out.buffer;
}

// content-length が無い応答もあるので、読みながら上限を超えたら打ち切る。
async function drain(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  acc: readonly Uint8Array[],
  total: number,
): Promise<readonly Uint8Array[] | null> {
  const { done, value } = await reader.read();
  if (done) return acc;
  const next = total + value.byteLength;
  if (next > MAX_BYTES) {
    await reader.cancel();
    return null;
  }
  return drain(reader, [...acc, value], next);
}

async function fetchPage(url: string): Promise<FetchedPage> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; jgs.me crawler)" },
    });
  } catch (e) {
    return {
      status: 0,
      finalUrl: url,
      contentType: "",
      bytes: null,
      skip: `fetch: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const contentType = res.headers.get("content-type") ?? "";
  const base = { status: res.status, finalUrl: res.url || url, contentType };
  if (!mimeKind(contentType)) {
    await res.body?.cancel();
    return { ...base, bytes: null };
  }
  const bytes = await readCapped(res);
  if (!bytes) return { ...base, bytes: null, skip: "too large" };
  return { ...base, bytes };
}

const META = "meta.json";

function deps(env: Env): CrawlDeps {
  return {
    fetchPage,
    toMarkdown: async (bytes, mimeType, url) => {
      const r = await env.AI.toMarkdown(
        {
          name: mimeType === "application/pdf" ? "page.pdf" : "page.html",
          blob: new Blob([bytes], { type: mimeType }),
        },
        { conversionOptions: { html: { hostname: new URL(url).hostname } } },
      );
      if (r.format === "error") throw new Error(r.error);
      return r.data;
    },
    readMeta: async (key) => {
      const obj = await env.CRAWL.get(`${key}/${META}`);
      return obj ? ((await obj.json()) as CrawlMeta) : null;
    },
    write: async (key, { raw, md, meta }) => {
      // 取り直しで本文が取れなかった時に古い本文が meta とずれて残らないよう消す。
      await Promise.all([
        raw
          ? env.CRAWL.put(`${key}/raw`, raw, {
              httpMetadata: { contentType: meta.contentType },
            })
          : env.CRAWL.delete(`${key}/raw`),
        md
          ? env.CRAWL.put(`${key}/page.md`, md, {
              httpMetadata: { contentType: "text/markdown; charset=utf-8" },
            })
          : env.CRAWL.delete(`${key}/page.md`),
      ]);
      await env.CRAWL.put(`${key}/${META}`, JSON.stringify(meta), {
        httpMetadata: { contentType: "application/json" },
      });
    },
    now: () => new Date(),
  };
}

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

export async function handleCrawlPost(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    force?: unknown;
  } | null;
  if (body === null) {
    return Response.json({ error: "invalid json" }, { status: BAD_REQUEST });
  }
  const url = typeof body.url === "string" ? normalizeUrl(body.url) : null;
  if (!url) {
    return Response.json(
      { error: "url must be http(s)" },
      { status: BAD_REQUEST },
    );
  }
  return Response.json(await runCrawl(deps(env), url, body.force === true));
}

export async function handleCrawlGet(
  request: Request,
  env: Env,
): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  const url = raw ? normalizeUrl(raw) : null;
  if (!url) {
    return Response.json(
      { error: "url must be http(s)" },
      { status: BAD_REQUEST },
    );
  }
  const key = await crawlKey(url);
  const [meta, md] = await Promise.all([
    env.CRAWL.get(`${key}/${META}`),
    env.CRAWL.get(`${key}/page.md`),
  ]);
  if (!meta) {
    return Response.json({ error: "not crawled" }, { status: NOT_FOUND });
  }
  return Response.json({
    meta: (await meta.json()) as CrawlMeta,
    md: md ? await md.text() : null,
  });
}
