import { describe, expect, it } from "vitest";
import {
  runFetch,
  runProbe,
  runRewrite,
  runScan,
  type FetchDeps,
  type PageRow,
  type ProbeDeps,
  type RewriteDeps,
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
    const rows = [page({ id: 1, image: `https://gyazo.com/${B}/raw` })];
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

  // limit=0 は SQLite の LIMIT 0 で 0 件を返す。rows[-1] を踏んで
  // TypeError にならず null を返すこと。CLI から --pages 0 を打つと
  // nextLimit が 0 を返すので実際に起こりうる。
  it("limit が 0 で rows が空でも nextCursor は null", async () => {
    const rows = [page({ id: 1 })];
    const d = deps(rows, {});

    const r = await runScan(d, 0, 0);

    expect(r.processed).toBe(0);
    expect(r.nextCursor).toBeNull();
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

const png = new TextEncoder().encode("png-bytes").buffer as ArrayBuffer;

function fetchDeps(over: Partial<FetchDeps> = {}) {
  const recorded: unknown[] = [];
  const deps: FetchDeps = {
    known: async () => new Set(),
    download: async () => ({
      status: 200,
      contentType: "image/png",
      body: png,
    }),
    put: async () => "deadbeef.png",
    record: async (row) => {
      recorded.push(row);
    },
    ...over,
  };
  return { deps, recorded };
}

describe("runFetch", () => {
  it("取得して put して対応表に記録する", async () => {
    const { deps, recorded } = fetchDeps();

    const r = await runFetch(deps, [A]);

    expect(recorded).toEqual([
      {
        gyazoHash: A,
        r2Key: "deadbeef.png",
        contentType: "image/png",
        bytes: png.byteLength,
      },
    ]);
    expect(r.items[0]).toEqual({
      gyazoHash: A,
      r2Key: "deadbeef.png",
      bytes: png.byteLength,
      contentType: "image/png",
    });
  });

  // 再実行を安くする。取り込み済みは触らない。
  it("既に対応表にあるハッシュは飛ばす", async () => {
    const { deps, recorded } = fetchDeps({ known: async () => new Set([A]) });

    const r = await runFetch(deps, [A]);

    expect(recorded).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.processed).toBe(1);
  });

  it("200 以外は error にして記録しない", async () => {
    const { deps, recorded } = fetchDeps({
      download: async () => ({ status: 403, contentType: null, body: png }),
    });

    const r = await runFetch(deps, [A]);

    expect(r.items[0]).toEqual({ gyazoHash: A, error: "status 403" });
    expect(recorded).toEqual([]);
  });

  it("未対応の Content-Type は error にして記録しない", async () => {
    const { deps, recorded } = fetchDeps({
      download: async () => ({
        status: 200,
        contentType: "application/pdf",
        body: png,
      }),
      put: async () => null,
    });

    const r = await runFetch(deps, [A]);

    expect(r.items[0]).toEqual({
      gyazoHash: A,
      error: "unsupported content type: application/pdf",
    });
    expect(recorded).toEqual([]);
  });

  // Gyazo が charset 付きで返しても拡張子の解決を落とさない。
  it("Content-Type のパラメータを落として渡す", async () => {
    const seen: string[] = [];
    const { deps } = fetchDeps({
      download: async () => ({
        status: 200,
        contentType: "image/png; charset=binary",
        body: png,
      }),
      put: async (_bytes, contentType) => {
        seen.push(contentType);
        return "deadbeef.png";
      },
    });

    await runFetch(deps, [A]);

    expect(seen).toEqual(["image/png"]);
  });

  it("download が投げたら error にして続ける", async () => {
    const { deps } = fetchDeps({
      download: async (url) => {
        if (url.includes(A)) throw new Error("boom");
        return { status: 200, contentType: "image/png", body: png };
      },
    });

    const r = await runFetch(deps, [A, B]);

    expect(r.items[0]).toEqual({ gyazoHash: A, error: "boom" });
    expect(r.items[1]).toMatchObject({ gyazoHash: B, r2Key: "deadbeef.png" });
  });
});

function rewriteDeps(
  rows: PageRow[],
  bodies: Record<string, string>,
  over: Partial<RewriteDeps> = {},
) {
  const calls: string[] = [];
  const backedUp: Record<string, string> = {};
  const written: Record<string, string> = {};
  const images: Record<number, string> = {};
  const deps: RewriteDeps = {
    listArticlePages: async (cursor, limit) =>
      rows.filter((r) => r.id > cursor).slice(0, limit),
    readBody: async (bodyKey) => bodies[bodyKey] ?? null,
    backupBody: async (bodyKey, raw) => {
      calls.push(`backup:${bodyKey}`);
      backedUp[bodyKey] = raw;
    },
    writeBody: async (bodyKey, raw) => {
      calls.push(`write:${bodyKey}`);
      written[bodyKey] = raw;
    },
    resolve: (hash) => (hash === A ? "https://r2.jgs.me/deadbeef.png" : null),
    setImage: async (row, image) => {
      images[row.id] = image;
    },
    ...over,
  };
  return { deps, calls, backedUp, written, images };
}

describe("runRewrite", () => {
  it("本文を置換して書き戻す", async () => {
    const rows = [page({ id: 1 })];
    const { deps, written } = rewriteDeps(rows, {
      "sb-1": `題\nhttps://gyazo.com/${A}/raw`,
    });

    const r = await runRewrite(deps, 0, 20);

    expect(written["sb-1"]).toBe("題\nhttps://r2.jgs.me/deadbeef.png");
    expect(r.items[0]).toEqual({
      pageId: 1,
      title: "題1",
      replaced: 1,
      skipped: 0,
      imageReplaced: false,
    });
  });

  // 退避してから上書きする。順番が逆だと元に戻せない。
  // 中身も突き合わせる: 置換後のものを退避していたらバックアップの意味が消える。
  it("上書きの前に退避する", async () => {
    const rows = [page({ id: 1 })];
    const rawOriginal = `題\nhttps://gyazo.com/${A}/raw`;
    const { deps, calls, backedUp, written } = rewriteDeps(rows, {
      "sb-1": rawOriginal,
    });

    await runRewrite(deps, 0, 20);

    expect(calls).toEqual(["backup:sb-1", "write:sb-1"]);
    expect(backedUp["sb-1"]).toBe(rawOriginal);
    expect(written["sb-1"]).toBe("題\nhttps://r2.jgs.me/deadbeef.png");
  });

  // 置換対象が無いページに無駄な書き込みをしない。
  it("置換が 0 件なら退避も書き込みもしない", async () => {
    const rows = [page({ id: 1 })];
    const { deps, calls } = rewriteDeps(rows, { "sb-1": "題\n本文" });

    const r = await runRewrite(deps, 0, 20);

    expect(calls).toEqual([]);
    expect(r.items[0]!.replaced).toBe(0);
  });

  it("対応表に無いハッシュは残して skipped に数える", async () => {
    const rows = [page({ id: 1 })];
    const { deps, calls } = rewriteDeps(rows, {
      "sb-1": `題\nhttps://gyazo.com/${B}/raw`,
    });

    const r = await runRewrite(deps, 0, 20);

    expect(calls).toEqual([]);
    expect(r.items[0]!.skipped).toBe(1);
  });

  it("page.image も差し替える", async () => {
    const rows = [page({ id: 1, image: `https://gyazo.com/${A}/raw` })];
    const { deps, images } = rewriteDeps(rows, { "sb-1": "題\n本文" });

    const r = await runRewrite(deps, 0, 20);

    expect(images[1]).toBe("https://r2.jgs.me/deadbeef.png");
    expect(r.items[0]!.imageReplaced).toBe(true);
  });

  it("page.image が対応表に無ければ触らない", async () => {
    const rows = [page({ id: 1, image: `https://gyazo.com/${B}/raw` })];
    const { deps, images } = rewriteDeps(rows, { "sb-1": "題\n本文" });

    const r = await runRewrite(deps, 0, 20);

    expect(images).toEqual({});
    expect(r.items[0]!.imageReplaced).toBe(false);
  });

  it("本文が R2 に無くても落ちない", async () => {
    const rows = [page({ id: 1 })];
    const { deps, calls } = rewriteDeps(rows, {});

    const r = await runRewrite(deps, 0, 20);

    expect(calls).toEqual([]);
    expect(r.items[0]!.replaced).toBe(0);
  });

  it("limit まで取れたら nextCursor に最後の page.id を返す", async () => {
    const rows = [page({ id: 1 }), page({ id: 2 }), page({ id: 3 })];
    const { deps } = rewriteDeps(rows, {});

    const r = await runRewrite(deps, 0, 2);

    expect(r.nextCursor).toBe(2);
  });

  // runScan は同じケースを try/catch して item.error に載せる (非対称の解消)。
  // ここが素通しだとリクエストごと 500 になり nextCursor が返らない。CLI は
  // cursor を渡す口を持たないので、再実行しても同じ page で毎回止まってしまう。
  it("本文の JSON が壊れていてもそのページだけ error にして次に進む", async () => {
    const rows = [page({ id: 1, bodyKey: "sbid" }), page({ id: 2 })];
    const { deps } = rewriteDeps(rows, {
      sbid: "{ broken",
      "sb-2": `題\nhttps://gyazo.com/${A}/raw`,
    });

    const r = await runRewrite(deps, 0, 20);

    expect(r.processed).toBe(2);
    expect(r.items[0]!.error).toBeTypeOf("string");
    expect(r.items[0]).toMatchObject({
      pageId: 1,
      replaced: 0,
      skipped: 0,
      imageReplaced: false,
    });
    expect(r.items[1]!.error).toBeUndefined();
    expect(r.items[1]).toMatchObject({ pageId: 2, replaced: 1 });
  });

  // runScan と同じ理由。limit=0 で rows[-1] を踏まない。
  it("limit が 0 で rows が空でも nextCursor は null", async () => {
    const rows = [page({ id: 1 })];
    const { deps } = rewriteDeps(rows, {});

    const r = await runRewrite(deps, 0, 0);

    expect(r.processed).toBe(0);
    expect(r.nextCursor).toBeNull();
  });

  // 再現手順 (レビュアーが実際に踏んだ順序):
  // 1. page が hash A と B を参照。1 回目の fetch で A は成功、B は失敗。
  // 2. rewrite → A だけ置換されて原本が退避される。
  // 3. fetch をやり直して B も対応表に載る。
  // 4. rewrite を再実行 → B が置換できる。このとき「A だけ置換済みの本文」を
  //    退避に使うと、1 回目に取った原本が失われてロールバックできなくなる。
  // backupBody は既に退避済みなら書かない (ハンドラ側の実装と同じ意味論) 前提で、
  // fake にも同じ状態を持たせて runRewrite 経由で固定する。
  it("2 回目の rewrite ではバックアップを上書きしない", async () => {
    const rawOriginal = `題\nhttps://gyazo.com/${A}/raw\nhttps://gyazo.com/${B}/raw`;
    const bodies: Record<string, string> = { "sb-1": rawOriginal };
    const backedUp: Record<string, string> = {};
    let resolvable: Record<string, string> = {
      [A]: "https://r2.jgs.me/a.png",
    };

    const rows = [page({ id: 1 })];
    const deps: RewriteDeps = {
      listArticlePages: async (cursor, limit) =>
        rows.filter((r) => r.id > cursor).slice(0, limit),
      readBody: async (bodyKey) => bodies[bodyKey] ?? null,
      // ハンドラ側の実装 (packages/ingest/src/gyazoMigrate.ts の backupBody) と
      // 同じ意味論: 既に退避済みなら書かない。
      backupBody: async (bodyKey, raw) => {
        if (bodyKey in backedUp) return;
        backedUp[bodyKey] = raw;
      },
      writeBody: async (bodyKey, raw) => {
        bodies[bodyKey] = raw;
      },
      resolve: (hash) => resolvable[hash] ?? null,
      setImage: async () => {},
    };

    // 1 回目: A だけ解決できる (B は Gyazo 側の一時エラー等で失敗した想定)。
    await runRewrite(deps, 0, 20);
    expect(backedUp["sb-1"]).toBe(rawOriginal);

    // fetch をやり直して B も対応表に載った想定。
    resolvable = {
      [A]: "https://r2.jgs.me/a.png",
      [B]: "https://r2.jgs.me/b.png",
    };

    // 2 回目: B も解決できるので replaced > 0 になり backupBody がまた呼ばれる。
    await runRewrite(deps, 0, 20);

    // 退避されているのは 1 回目の原本のまま。2 回目の「A だけ置換済みの本文」で
    // 上書きされていたら原本が失われる。
    expect(backedUp["sb-1"]).toBe(rawOriginal);
  });
});
