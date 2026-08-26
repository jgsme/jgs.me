import { describe, expect, it } from "vitest";
import {
  runProbe,
  runScan,
  type PageRow,
  type ProbeDeps,
  type ScanDeps,
} from "./gyazoMigrate";

const A = "0123456789abcdef0123456789abcdef";
const B = "fedcba9876543210fedcba9876543210";

function page(over: Partial<PageRow> & { id: number }): PageRow {
  return {
    title: `題${over.id}`,
    bodyKey: `sb-${over.id}`,
    image: null,
    updated: "2020-01-01T00:00:00.000Z",
    ...over,
  };
}

function deps(rows: PageRow[], bodies: Record<string, string>): ScanDeps {
  return {
    listArticlePages: async (cursor, limit) =>
      rows.filter((r) => r.id > cursor).slice(0, limit),
    readBody: async (bodyKey) => bodies[bodyKey] ?? null,
  };
}

describe("runScan", () => {
  it("本文と page.image からハッシュを集める", async () => {
    const rows = [
      page({ id: 1, image: `https://gyazo.com/${B}/raw` }),
    ];
    const d = deps(rows, { "sb-1": `題\nhttps://gyazo.com/${A}/raw` });

    const r = await runScan(d, 0, 20);

    expect(r.items).toEqual([
      {
        pageId: 1,
        title: "題1",
        hashes: [A],
        imageHash: B,
        scrapboxFiles: 0,
      },
    ]);
  });

  it("scrapbox.io/files の件数を数える", async () => {
    const rows = [page({ id: 1 })];
    const d = deps(rows, {
      "sb-1": `題\nhttps://scrapbox.io/files/${A}.png\nhttps://scrapbox.io/files/${B}`,
    });

    const r = await runScan(d, 0, 20);

    expect(r.items[0]!.scrapboxFiles).toBe(2);
  });

  // 取り切ったかどうかは limit に届いたかで決める。
  it("limit まで取れたら nextCursor に最後の page.id を返す", async () => {
    const rows = [page({ id: 1 }), page({ id: 2 }), page({ id: 3 })];
    const d = deps(rows, {});

    const r = await runScan(d, 0, 2);

    expect(r.processed).toBe(2);
    expect(r.nextCursor).toBe(2);
  });

  it("limit に満たなければ nextCursor は null", async () => {
    const rows = [page({ id: 1 })];
    const d = deps(rows, {});

    const r = await runScan(d, 0, 20);

    expect(r.nextCursor).toBeNull();
  });

  it("cursor より後ろの page だけ見る", async () => {
    const rows = [page({ id: 1 }), page({ id: 2 })];
    const d = deps(rows, {});

    const r = await runScan(d, 1, 20);

    expect(r.items.map((i) => i.pageId)).toEqual([2]);
  });

  it("本文が R2 に無くても落ちない", async () => {
    const rows = [page({ id: 1 })];
    const d = deps(rows, {});

    const r = await runScan(d, 0, 20);

    expect(r.items[0]!.hashes).toEqual([]);
  });

  // 1 件の壊れた本文でバッチ全体を止めない。何が壊れたかは items に残す。
  it("本文の JSON が壊れていてもそのページだけ error にして続ける", async () => {
    const rows = [page({ id: 1, bodyKey: "sbid" }), page({ id: 2 })];
    const d = deps(rows, {
      sbid: "{ broken",
      "sb-2": `題\nhttps://gyazo.com/${A}`,
    });

    const r = await runScan(d, 0, 20);

    expect(r.items[0]!.error).toBeTypeOf("string");
    expect(r.items[0]!.hashes).toEqual([]);
    expect(r.items[1]!.hashes).toEqual([A]);
  });
});

describe("runProbe", () => {
  it("HEAD の status と Content-Length を返す", async () => {
    const deps: ProbeDeps = {
      head: async (url) => {
        expect(url).toBe(`https://gyazo.com/${A}/raw`);
        return {
          status: 200,
          contentLength: "1234",
          contentType: "image/png",
        };
      },
    };

    const r = await runProbe(deps, [A]);

    expect(r.processed).toBe(1);
    expect(r.items).toEqual([
      { gyazoHash: A, status: 200, bytes: 1234, contentType: "image/png" },
    ]);
  });

  // 非公開だとここに 403 が並ぶ。全滅ならトークンを使う設計に組み直す判断材料。
  it("200 以外もそのまま返す", async () => {
    const deps: ProbeDeps = {
      head: async () => ({
        status: 403,
        contentLength: null,
        contentType: null,
      }),
    };

    const r = await runProbe(deps, [A]);

    expect(r.items[0]).toEqual({
      gyazoHash: A,
      status: 403,
      bytes: null,
      contentType: null,
    });
  });

  // 1 件の通信エラーで残りの打診を捨てない。
  it("head が投げたら status 0 にして続ける", async () => {
    const deps: ProbeDeps = {
      head: async (url) => {
        if (url.includes(A)) throw new Error("boom");
        return { status: 200, contentLength: "1", contentType: "image/png" };
      },
    };

    const r = await runProbe(deps, [A, B]);

    expect(r.items[0]!.status).toBe(0);
    expect(r.items[1]!.status).toBe(200);
  });

  it("Content-Length が数値でなければ bytes は null", async () => {
    const deps: ProbeDeps = {
      head: async () => ({
        status: 200,
        contentLength: "chunked",
        contentType: "image/png",
      }),
    };

    const r = await runProbe(deps, [A]);

    expect(r.items[0]!.bytes).toBeNull();
  });
});
