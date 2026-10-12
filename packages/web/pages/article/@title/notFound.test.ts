import { afterEach, expect, it, vi } from "vitest";
import { fetchBody } from "@jigsaw/db/fetch-body";
import { fetchBacklinks } from "@/server/backlinks";
import data from "./+data";

// page 行の引き当て。leftJoin を何段つないでも最後は limit で空配列を返す。
vi.mock("@/db/getDB", () => {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "from", "leftJoin", "where"]) {
    query[m] = () => query;
  }
  query.limit = async () => [];
  return { getDB: () => query };
});
vi.mock("@jigsaw/db/fetch-body", () => ({ fetchBody: vi.fn() }));
vi.mock("@/server/backlinks", () => ({
  BACKLINK_INITIAL: 12,
  fetchBacklinks: vi.fn(),
}));
vi.mock("vike-react/useConfig", () => ({ useConfig: () => () => {} }));

afterEach(() => {
  vi.clearAllMocks();
});

const context = (title: string) =>
  ({
    urlOriginal: `https://w.jgs.me/pages/${encodeURIComponent(title)}`,
    env: {},
  }) as unknown as Parameters<typeof data>[0];

// 存在しない題を 200 で返すと、外形監視のステータスチェックが壊れた URL を
// 見逃す (href の &#x27; を叩いて「Page not found」を 200 で受けていた)。
it("本文も被リンクも無い題は 404 にする", async () => {
  vi.mocked(fetchBody).mockResolvedValue(null);
  vi.mocked(fetchBacklinks).mockResolvedValue({
    backlinks: [],
    hasMore: false,
  });

  await expect(data(context("無い題"))).rejects.toMatchObject({
    _pageContextAbort: { abortStatusCode: 404 },
  });
});

it("本文が無くても被リンクがあれば題と被リンクのページを出す", async () => {
  vi.mocked(fetchBody).mockResolvedValue(null);
  vi.mocked(fetchBacklinks).mockResolvedValue({
    backlinks: [{ title: "リンク元", image: null }],
    hasMore: false,
  });

  const d = await data(context("リンクだけある題"));
  expect(d.ok).toBe(false);
  expect(d.backlinks).toEqual([{ title: "リンク元", image: null }]);
});
