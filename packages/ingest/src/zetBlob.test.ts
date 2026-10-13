import { describe, expect, it } from "vitest";
import {
  blobRehoster,
  runZetRehost,
  type ZetRehostDeps,
  type ZetRehostRow,
} from "./zetBlob";

const BLOB =
  "https://ds.jgs.me/xrpc/com.atproto.sync.getBlob?did=did:web:ds.jgs.me&cid=bafkreiimg";
const R2 = "https://r2.jgs.me/abc.png";

describe("blobRehoster", () => {
  it("getBlob を落として put し、MEDIA_BASE_URL のキーを返す", async () => {
    const seen: string[] = [];
    const put: [number, string][] = [];
    const rehost = blobRehoster(
      async (url) => {
        seen.push(url);
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg; charset=binary" },
        });
      },
      async (bytes, type) => {
        put.push([bytes.byteLength, type]);
        return "abc.jpg";
      },
      "https://r2.jgs.me",
    );
    expect(await rehost(BLOB)).toBe("https://r2.jgs.me/abc.jpg");
    expect(seen).toEqual([BLOB]);
    expect(put).toEqual([[3, "image/jpeg"]]);
  });

  it("未対応の Content-Type は null", async () => {
    const rehost = blobRehoster(
      async () =>
        new Response("x", { headers: { "Content-Type": "image/heic" } }),
      async () => null,
      "https://r2.jgs.me",
    );
    expect(await rehost(BLOB)).toBeNull();
  });

  it("PDS が 200 以外なら投げる", async () => {
    const rehost = blobRehoster(
      async () => new Response("", { status: 404 }),
      async () => "never",
      "https://r2.jgs.me",
    );
    await expect(rehost(BLOB)).rejects.toThrow("404");
  });
});

const row: ZetRehostRow = {
  pageID: 7,
  zetID: 3,
  rkey: "3m2abcdefghij",
  bodyKey: "sb-x",
  image: `${BLOB}#.png`,
  updated: "2026-10-11T01:00:00.000Z",
};

function fake(body: string | null, over: Partial<ZetRehostDeps> = {}) {
  const calls = {
    writeBody: [] as [string, string][],
    setImage: [] as string[],
    purge: [] as string[][],
  };
  const deps: ZetRehostDeps = {
    listZets: async () => [row],
    readBody: async () => body,
    writeBody: async (key, b) => {
      calls.writeBody.push([key, b]);
    },
    setImage: async (_, image) => {
      calls.setImage.push(image);
    },
    purge: async (paths) => {
      calls.purge.push(paths);
    },
    rehost: async () => R2,
    ...over,
  };
  return { deps, calls };
}

describe("runZetRehost", () => {
  it("本文と page.image を R2 の URL に書き換えて purge する", async () => {
    const { deps, calls } = fake(`zet:${row.rkey}\n[${BLOB}#.png]`);
    const r = await runZetRehost(deps, 0, 10);
    expect(r.items).toEqual([
      { pageId: 7, rkey: row.rkey, blobs: 1, rehosted: 1 },
    ]);
    expect(calls.writeBody).toEqual([["sb-x", `zet:${row.rkey}\n[${R2}]`]]);
    expect(calls.setImage).toEqual([R2]);
    expect(calls.purge).toEqual([
      ["/zets", `/pages/zet%3A${row.rkey}`, "/p/7", "/z/3"],
    ]);
  });

  it("blob が無ければ何も書かない", async () => {
    const { deps, calls } = fake(`zet:${row.rkey}\n散歩した`);
    await runZetRehost(deps, 0, 10);
    expect(calls.writeBody).toEqual([]);
    expect(calls.purge).toEqual([]);
  });

  it("写せなければ書かずに次へ行く", async () => {
    const { deps, calls } = fake(`zet:${row.rkey}\n[${BLOB}#.png]`, {
      rehost: async () => null,
    });
    const r = await runZetRehost(deps, 0, 10);
    expect(r.items[0]).toMatchObject({ blobs: 1, rehosted: 0 });
    expect(calls.writeBody).toEqual([]);
  });

  it("limit に届けば最後の pageID を nextCursor に返す", async () => {
    const { deps } = fake(null);
    expect((await runZetRehost(deps, 0, 1)).nextCursor).toBe(7);
    expect((await runZetRehost(deps, 0, 2)).nextCursor).toBeNull();
  });
});
