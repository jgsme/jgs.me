import { describe, expect, it, vi, beforeEach } from "vitest";

const ID = "a".repeat(64);

type Row = Record<string, unknown>;
let rows: Row[] = [];
let titleSet: string | undefined;

// drizzle のクエリビルダはチェーン。行の配列だけ返せれば足りる。
vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(rows) }),
      }),
    }),
  }),
}));

vi.mock("vike-react/useConfig", () => ({
  useConfig: () => (c: { title?: string }) => {
    titleSet = c.title;
  },
}));

const { default: data } = await import("./+data");

const ctx = {
  env: { DB: {} },
  routeParams: { id: ID },
} as unknown as Parameters<typeof data>[0];

function row(over: Row = {}): Row {
  return {
    id: ID,
    ext: "png",
    sourceURL: "https://example.com/article",
    srcURL: "https://example.com/i.png",
    sourceTitle: "元記事",
    width: 1200,
    height: 800,
    bytes: 123,
    created: "2026-09-04 12:00:00",
    ...over,
  };
}

beforeEach(() => {
  rows = [row()];
  titleSet = undefined;
});

describe("+data", () => {
  it("直リンクを r2.jgs.me/<id>.<ext> で組む", async () => {
    const d = await data(ctx);
    expect(d.direct).toBe(`https://r2.jgs.me/${ID}.png`);
  });

  it("寸法と日時をそのまま渡す", async () => {
    const d = await data(ctx);
    expect(d).toMatchObject({
      id: ID,
      ext: "png",
      width: 1200,
      height: 800,
      created: "2026-09-04 12:00:00",
    });
  });

  it("出典を safeHref 経由のリンクにする", async () => {
    expect((await data(ctx)).source).toEqual({
      href: "https://example.com/article",
      label: "元記事",
    });
  });

  it("javascript: の出典はリンクにしない", async () => {
    rows = [row({ sourceURL: "javascript:alert(1)" })];
    expect((await data(ctx)).source).toBeNull();
  });

  it("題があれば og:title に使う", async () => {
    await data(ctx);
    expect(titleSet).toBe("元記事");
  });

  // 題が無い画像もある。og:title を空にすると unfurl のカードが無題になる。
  it("題が無ければ og:title は jgs.me", async () => {
    rows = [row({ sourceTitle: null })];
    await data(ctx);
    expect(titleSet).toBe("jgs.me");
  });

  // 行は消えうる (DELETE /api/images/:id)。消えた後も 200 を返すと
  // unfurl 側に空のカードが焼かれる。
  it("行が無ければ 404 を投げる", async () => {
    rows = [];
    await expect(data(ctx)).rejects.toMatchObject({
      _isAbortError: true,
      _pageContextAbort: { abortStatusCode: 404, is404: true },
    });
  });
});
