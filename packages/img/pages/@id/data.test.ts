import { describe, expect, it, vi, beforeEach } from "vitest";

const ID = "a".repeat(64);

type Row = Record<string, unknown>;
let rows: Row[] = [];

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

const { default: data } = await import("./+data");

type Obj = { key: string; size: number; uploaded: Date };
let objects: Obj[] = [];

const ctx = {
  env: {
    DB: {},
    MEDIA: {
      list: async ({ prefix }: { prefix: string }) => ({
        objects: objects.filter((o) => o.key.startsWith(prefix)),
      }),
    },
  },
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
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  rows = [row()];
  objects = [
    { key: `${ID}.png`, size: 123, uploaded: new Date("2026-09-01T00:00:00Z") },
  ];
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

  // 拡張から投稿していない画像 (micropub / Gyazo 由来) も、w-media にあれば
  // ページにする。寸法は知らないので出さない。
  it("行が無ければ R2 から組む", async () => {
    rows = [];
    objects = [
      {
        key: `${ID}.jpg`,
        size: 42,
        uploaded: new Date("2026-09-01T01:02:03Z"),
      },
    ];
    const d = await data(ctx);
    expect(d).toEqual({
      id: ID,
      ext: "jpg",
      direct: `https://r2.jgs.me/${ID}.jpg`,
      width: null,
      height: null,
      created: "2026-09-01 01:02:03",
    });
  });

  // 消した後も 200 を返すと unfurl 側に空のカードが焼かれる。
  it("行が無く R2 にも無ければ 404 を投げる", async () => {
    rows = [];
    objects = [];
    await expect(data(ctx)).rejects.toMatchObject({
      _isAbortError: true,
      _pageContextAbort: { abortStatusCode: 404, is404: true },
    });
  });

  // R2 の実体は残っているが、ページは消した。
  it("消した印があれば R2 にあっても 404 を投げる", async () => {
    rows = [row({ deletedAt: "2026-09-10 00:00:00" })];
    await expect(data(ctx)).rejects.toMatchObject({
      _isAbortError: true,
      _pageContextAbort: { abortStatusCode: 404, is404: true },
    });
  });
});
