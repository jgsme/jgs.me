import { describe, expect, it } from "vitest";
import {
  crawlKey,
  frontmatterTitle,
  mimeKind,
  normalizeUrl,
  plainLength,
  runCrawl,
  type CrawlDeps,
  type CrawlMeta,
  type FetchedPage,
} from "./crawl";

const URL_A = "https://example.com/a";
const NOW = new Date("2026-10-20T00:00:00Z");
const RECENT = "2026-10-10T00:00:00Z";
const STALE = "2026-09-01T00:00:00Z";
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const MD =
  "---\ntitle: 題\n---\n\n本文 [リンク](https://x.example/long) ![](https://x.example/a.png)";

type Written = {
  readonly key: string;
  readonly md: string | null;
  readonly hasRaw: boolean;
  readonly meta: CrawlMeta;
};

function html(): ArrayBuffer {
  const u = new TextEncoder().encode("<html><body>本文</body></html>");
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

function setup(
  page: FetchedPage,
  cached: CrawlMeta | null = null,
): {
  readonly deps: CrawlDeps;
  readonly written: Written[];
  readonly fetched: string[];
} {
  const written: Written[] = [];
  const fetched: string[] = [];
  return {
    written,
    fetched,
    deps: {
      fetchPage: async (url) => {
        fetched.push(url);
        return page;
      },
      toMarkdown: async () => MD,
      readMeta: async () => cached,
      write: async (key, f) => {
        written.push({ key, md: f.md, hasRaw: f.raw !== null, meta: f.meta });
      },
      now: () => NOW,
    },
  };
}

const okPage: FetchedPage = {
  status: HTTP_OK,
  finalUrl: URL_A,
  contentType: "text/html; charset=utf-8",
  bytes: html(),
};

function cachedMeta(fetchedAt: string): CrawlMeta {
  return {
    url: URL_A,
    finalUrl: URL_A,
    redirected: false,
    status: HTTP_OK,
    contentType: "text/html",
    title: "古い",
    textLength: 1,
    contentHash: "h",
    fetchedAt,
  };
}

describe("normalizeUrl", () => {
  it("host を小文字にし、fragment と utm_* を落とす", () => {
    expect(
      normalizeUrl("https://Example.COM/a?utm_source=x&b=1&UTM_medium=y#top"),
    ).toBe("https://example.com/a?b=1");
  });

  it("http(s) 以外と壊れた URL は null", () => {
    expect(normalizeUrl("ftp://example.com/")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("helpers", () => {
  it("html と pdf だけを変換対象にする", () => {
    expect(mimeKind("text/html; charset=utf-8")).toBe("html");
    expect(mimeKind("application/pdf")).toBe("pdf");
    expect(mimeKind("image/png")).toBeNull();
  });

  it("frontmatter から title を読む", () => {
    expect(frontmatterTitle(MD)).toBe("題");
    expect(frontmatterTitle("本文だけ")).toBe("");
  });

  it("文字数はリンク先 URL と画像を数えない", () => {
    expect(plainLength(MD)).toBe("本文リンク".length);
  });
});

describe("runCrawl", () => {
  it("取って md と原本と meta を書く", async () => {
    const { deps, written } = setup(okPage);

    const meta = await runCrawl(deps, URL_A, false);

    expect(meta).toMatchObject({
      url: URL_A,
      redirected: false,
      title: "題",
      textLength: "本文リンク".length,
      fetchedAt: NOW.toISOString(),
    });
    expect(meta.skip).toBeUndefined();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      key: await crawlKey(URL_A),
      md: MD,
      hasRaw: true,
    });
  });

  it("30 日以内に取ったものは取り直さない", async () => {
    const { deps, fetched, written } = setup(okPage, cachedMeta(RECENT));

    const meta = await runCrawl(deps, URL_A, false);

    expect(meta.title).toBe("古い");
    expect(fetched).toHaveLength(0);
    expect(written).toHaveLength(0);
  });

  it("古いものと force は取り直す", async () => {
    const stale = setup(okPage, cachedMeta(STALE));
    const forced = setup(okPage, cachedMeta(RECENT));

    await runCrawl(stale.deps, URL_A, false);
    await runCrawl(forced.deps, URL_A, true);

    expect(stale.fetched).toEqual([URL_A]);
    expect(forced.fetched).toEqual([URL_A]);
  });

  it("redirect 先が別 URL なら redirected", async () => {
    const { deps } = setup({ ...okPage, finalUrl: "https://example.com/b#x" });

    const meta = await runCrawl(deps, URL_A, false);

    expect(meta.finalUrl).toBe("https://example.com/b");
    expect(meta.redirected).toBe(true);
  });

  it("2xx 以外は本文を書かずに skip を残す", async () => {
    const { deps, written } = setup({ ...okPage, status: HTTP_NOT_FOUND });

    const meta = await runCrawl(deps, URL_A, false);

    expect(meta.skip).toBe(`status ${HTTP_NOT_FOUND}`);
    expect(written[0]).toMatchObject({ md: null, hasRaw: false });
  });

  it("対象外の content-type は skip に理由を書く", async () => {
    const { deps } = setup({
      ...okPage,
      contentType: "image/png",
      bytes: null,
    });

    const meta = await runCrawl(deps, URL_A, false);

    expect(meta.skip).toBe("unsupported content-type: image/png");
  });

  it("toMarkdown が失敗したら原本だけ残して skip", async () => {
    const { deps, written } = setup(okPage);
    const failing: CrawlDeps = {
      ...deps,
      toMarkdown: async () => {
        throw new Error("boom");
      },
    };

    const meta = await runCrawl(failing, URL_A, false);

    expect(meta.skip).toBe("toMarkdown: boom");
    expect(written[0]).toMatchObject({ md: null, hasRaw: true });
  });
});
