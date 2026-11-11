import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchBody } from "@jigsaw/db/fetch-body";
import data from "./+data";

const KEY = "A".repeat(43);

// drafts を key で 1 件引く。行は各テストが rows に積む。
const rows: unknown[] = [];
const limit = vi.fn(async () => rows);
vi.mock("@/db/getDB", () => {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) query[m] = () => query;
  query.limit = (...a: unknown[]) =>
    (limit as (...x: unknown[]) => unknown)(...a);
  return { getDB: () => query };
});
vi.mock("@jigsaw/db/fetch-body", () => ({ fetchBody: vi.fn() }));
vi.mock("@/server/oembed", () => ({ fetchOEmbeds: vi.fn(async () => ({})) }));
vi.mock("../../article/@title/xhtmParts", () => ({
  loadXhtmParts: vi.fn(async () => ({})),
}));

beforeEach(() => {
  rows.length = 0;
});
afterEach(() => {
  vi.clearAllMocks();
});

const R2 = {};
const context = (key: string, headers: Headers) =>
  ({
    routeParams: { key },
    headersResponse: headers,
    env: { R2, MEDIA: {}, DB: {} },
  }) as unknown as Parameters<typeof data>[0];

const row = { title: "題", bodyKey: "sb-1", spoiler: true };

it("形の崩れた鍵は D1 を引かずに 404", async () => {
  await expect(data(context("abc", new Headers()))).rejects.toMatchObject({
    _pageContextAbort: { abortStatusCode: 404 },
  });
  expect(limit).not.toHaveBeenCalled();
});

it("鍵に合う行が無ければ 404", async () => {
  await expect(data(context(KEY, new Headers()))).rejects.toMatchObject({
    _pageContextAbort: { abortStatusCode: 404 },
  });
  expect(limit).toHaveBeenCalled();
  expect(fetchBody).not.toHaveBeenCalled();
});

it("行はあるが本文が R2 に無ければ 404", async () => {
  rows.push(row);
  vi.mocked(fetchBody).mockResolvedValue(null);
  await expect(data(context(KEY, new Headers()))).rejects.toMatchObject({
    _pageContextAbort: { abortStatusCode: 404 },
  });
});

it("題・ブロック・spoiler を返す", async () => {
  rows.push(row);
  vi.mocked(fetchBody).mockResolvedValue("題\n本文");
  const d = await data(context(KEY, new Headers()));
  expect(d.title).toBe("題");
  expect(d.spoiler).toBe(true);
  expect(d.blocks.length).toBeGreaterThan(0);
});

it("404 でも 3 つのヘッダを付ける", async () => {
  const headers = new Headers();
  await expect(data(context("abc", headers))).rejects.toBeDefined();
  expect(headers.get("Cache-Control")).toBe("no-store");
  expect(headers.get("X-Robots-Tag")).toBe("noindex");
  expect(headers.get("Referrer-Policy")).toBe("no-referrer");
});

it("見つかったときも 3 つのヘッダを付ける", async () => {
  rows.push(row);
  vi.mocked(fetchBody).mockResolvedValue("題\n本文");
  const headers = new Headers();
  await data(context(KEY, headers));
  expect(headers.get("Cache-Control")).toBe("no-store");
  expect(headers.get("X-Robots-Tag")).toBe("noindex");
  expect(headers.get("Referrer-Policy")).toBe("no-referrer");
});

it("fetchBody に draft の bodyKey を渡す (page 表を引かない)", async () => {
  rows.push(row);
  vi.mocked(fetchBody).mockResolvedValue("題\n本文");
  await data(context(KEY, new Headers()));
  expect(fetchBody).toHaveBeenCalledWith(R2, "sb-1", "題");
  // drafts の 1 回だけ。page / backlinks / 関連記事の引き当てはしない。
  expect(limit).toHaveBeenCalledTimes(1);
});
