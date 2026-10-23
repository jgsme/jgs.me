import { describe, expect, it } from "vitest";
import {
  ingestZet,
  zetURL,
  type ZetCreateInput,
  type ZetDeps,
  type ZetUpdateInput,
} from "./zet";
import type { FetchZetResult, ZetRecord } from "./zetRecord";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`;
const BLOB =
  "https://ds.jgs.me/xrpc/com.atproto.sync.getBlob?did=did:web:ds.jgs.me&cid=bafkreiimg";
const R2 = "https://r2.jgs.me/abc.png";

const payload = {
  type: ["h-entry"],
  properties: { category: ["zet"], "at-uri": [AT_URI] },
};

const found = (
  over: Partial<ZetRecord> = {},
  cid = "bafycid1",
): FetchZetResult => ({
  ok: true,
  zet: {
    uri: AT_URI,
    cid,
    record: {
      text: `散歩した [公園] #朝\n[${BLOB}]`,
      title: null,
      date: "2026-10-11",
      createdAt: "2026-10-11T01:00:00.000Z",
      spoiler: false,
      ...over,
    },
    raw: '{"uri":"x"}',
  },
});

function fake(over: Partial<ZetDeps> = {}) {
  const calls = {
    getRecord: [] as string[],
    rehostBlob: [] as string[],
    putBody: [] as [string, string][],
    create: [] as ZetCreateInput[],
    update: [] as ZetUpdateInput[],
    publish: [] as [number, string][],
    purge: [] as string[][],
  };
  const deps: ZetDeps = {
    getRecord: async (rkey) => {
      calls.getRecord.push(rkey);
      return found();
    },
    rehostBlob: async (url) => {
      calls.rehostBlob.push(url);
      return R2;
    },
    findByAtUri: async () => null,
    putBody: async (key, body) => {
      calls.putBody.push([key, body]);
    },
    create: async (input) => {
      calls.create.push(input);
      return 42;
    },
    update: async (input) => {
      calls.update.push(input);
    },
    publish: async (pageID, kind) => {
      calls.publish.push([pageID, kind]);
    },
    purge: async (paths) => {
      calls.purge.push(paths);
    },
    newBodyKey: () => "sb-new",
    now: () => "2026-10-11T02:00:00.000Z",
    ...over,
  };
  return { deps, calls };
}

const existing = { pageID: 7, zetID: 3, bodyKey: "sb-old", cid: "bafyold" };

describe("zetURL", () => {
  it("w.jgs.me の /pages/zet%3A<rkey>", () => {
    expect(zetURL(RKEY)).toBe(`https://w.jgs.me/pages/zet%3A${RKEY}`);
  });
});

describe("ingestZet: create", () => {
  it("201 と Location を返す", async () => {
    const { deps } = fake();
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(
      `https://w.jgs.me/pages/zet%3A${RKEY}`,
    );
  });

  it("R2 には 1 行目が zet:<rkey> の本文を新しいキーで書く", async () => {
    const { deps, calls } = fake();
    await ingestZet(payload, deps);
    expect(calls.putBody).toHaveLength(1);
    const [key, body] = calls.putBody[0]!;
    expect(key).toBe("sb-new");
    expect(body.split("\n")[0]).toBe(`zet:${RKEY}`);
  });

  it("本文の getBlob URL を R2 に写した URL に差し替える", async () => {
    const { deps, calls } = fake();
    await ingestZet(payload, deps);
    expect(calls.rehostBlob).toEqual([BLOB]);
    expect(calls.putBody[0]![1]).toContain(`[${R2}]`);
    expect(calls.create[0]!.image).toBe(R2);
  });

  it("写せなかった blob は getBlob のまま画像の印を付けて取り込む", async () => {
    const { deps, calls } = fake({
      rehostBlob: async () => {
        throw new Error("pds down");
      },
    });
    expect((await ingestZet(payload, deps)).status).toBe(201);
    expect(calls.putBody[0]![1]).toContain(`[${BLOB}#.png]`);
    expect(calls.create[0]!.image).toBe(`${BLOB}#.png`);
  });

  it("page / zet / object / copy に入れる値を渡す", async () => {
    const { deps, calls } = fake();
    await ingestZet(payload, deps);
    expect(calls.create).toEqual([
      {
        pageTitle: `zet:${RKEY}`,
        rkey: RKEY,
        bodyKey: "sb-new",
        created: "2026-10-11T01:00:00.000Z",
        image: R2,
        spoiler: false,
        date: "2026-10-11",
        zetTitle: null,
        atUri: AT_URI,
        cid: "bafycid1",
        atproto: '{"uri":"x"}',
        mf2: JSON.stringify(payload),
        links: ["公園", "朝"],
      },
    ]);
    expect(calls.update).toEqual([]);
  });

  it("ネタバレの zet は spoiler を立て、画像をサムネに使わない", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ spoiler: true }),
    });
    await ingestZet(payload, deps);
    expect(calls.create[0]!.spoiler).toBe(true);
    expect(calls.create[0]!.image).toBeNull();
  });

  it("題があれば zetTitle に入れる", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ title: "朝の散歩" }),
    });
    await ingestZet(payload, deps);
    expect(calls.create[0]!.zetTitle).toBe("朝の散歩");
  });

  it("一覧を purge し、create で publish する", async () => {
    const { deps, calls } = fake();
    await ingestZet(payload, deps);
    expect(calls.purge).toEqual([["/zets"]]);
    expect(calls.publish).toEqual([[42, "create"]]);
  });

  it("D1 の書き込みが失敗したら 500 で publish しない", async () => {
    const { deps, calls } = fake({
      create: async () => {
        throw new Error("UNIQUE constraint failed: page.title");
      },
    });
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(500);
    expect(calls.publish).toEqual([]);
  });

  it("publish が throw しても 201 のまま", async () => {
    const { deps } = fake({
      publish: async () => {
        throw new Error("ap down");
      },
    });
    expect((await ingestZet(payload, deps)).status).toBe(201);
  });

  it("purge が throw しても 201 のまま", async () => {
    const { deps } = fake({
      purge: async () => {
        throw new Error("web down");
      },
    });
    expect((await ingestZet(payload, deps)).status).toBe(201);
  });
});

describe("ingestZet: update", () => {
  it("copy にあれば 200 と Location を返し、create しない", async () => {
    const { deps, calls } = fake({ findByAtUri: async () => existing });
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBe(
      `https://w.jgs.me/pages/zet%3A${RKEY}`,
    );
    expect(calls.create).toEqual([]);
  });

  it("R2 は既存のキーに上書きする", async () => {
    const { deps, calls } = fake({ findByAtUri: async () => existing });
    await ingestZet(payload, deps);
    expect(calls.putBody.map(([k]) => k)).toEqual(["sb-old"]);
  });

  it("本文以外に zet.title / zet.date / copy.cid / page.updated を更新する", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => existing,
      getRecord: async () =>
        found({ title: "改題", date: "2026-10-10" }, "bafycid2"),
    });
    await ingestZet(payload, deps);
    expect(calls.update).toEqual([
      {
        pageID: 7,
        updated: "2026-10-11T02:00:00.000Z",
        image: R2,
        spoiler: false,
        date: "2026-10-10",
        zetTitle: "改題",
        cid: "bafycid2",
        atproto: '{"uri":"x"}',
        mf2: JSON.stringify(payload),
        links: ["公園", "朝"],
      },
    ]);
  });

  it("個別・一覧・share URL (/p, /z) を purge し、update で publish する", async () => {
    const { deps, calls } = fake({ findByAtUri: async () => existing });
    await ingestZet(payload, deps);
    expect(calls.purge).toEqual([
      ["/zets", `/pages/zet%3A${RKEY}`, "/p/7", "/z/3"],
    ]);
    expect(calls.publish).toEqual([[7, "update"]]);
  });

  // diary の再送。publish すると本文中の外部リンクへ Webmention が毎回飛ぶ。
  it("CID が変わっていなければ何も書かず publish もしない", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => ({ ...existing, cid: "bafycid1" }),
    });
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(200);
    expect(calls.rehostBlob).toEqual([]);
    expect(calls.putBody).toEqual([]);
    expect(calls.update).toEqual([]);
    expect(calls.publish).toEqual([]);
    expect(calls.purge).toEqual([]);
  });

  it("D1 の書き込みが失敗したら 500 で publish しない", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => existing,
      update: async () => {
        throw new Error("d1 down");
      },
    });
    expect((await ingestZet(payload, deps)).status).toBe(500);
    expect(calls.publish).toEqual([]);
  });
});

describe("ingestZet: 失敗", () => {
  it("at-uri が不正なら 400 で PDS を引かない", async () => {
    const { deps, calls } = fake();
    const res = await ingestZet(
      {
        type: ["h-entry"],
        properties: {
          category: ["zet"],
          "at-uri": [`at://did:web:example.com/me.jgs.diary.zet/${RKEY}`],
        },
      },
      deps,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request" });
    expect(calls.getRecord).toEqual([]);
  });

  it("PDS の不調は 502 で何も書かない", async () => {
    const { deps, calls } = fake({
      getRecord: async () => ({
        ok: false,
        status: 502,
        description: "pds returned 503",
      }),
    });
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "server_error",
      error_description: "pds returned 503",
    });
    expect(calls.putBody).toEqual([]);
    expect(calls.create).toEqual([]);
    expect(calls.publish).toEqual([]);
  });

  it("record が無ければ 400 で何も書かない", async () => {
    const { deps, calls } = fake({
      getRecord: async () => ({
        ok: false,
        status: 400,
        description: `record not found: ${RKEY}`,
      }),
    });
    const res = await ingestZet(payload, deps);
    expect(res.status).toBe(400);
    expect(calls.putBody).toEqual([]);
  });

  it("PDS が別の record を返したら 502", async () => {
    const other = found();
    if (other.ok) other.zet.uri = `${AT_URI.slice(0, -1)}k`;
    const { deps, calls } = fake({ getRecord: async () => other });
    expect((await ingestZet(payload, deps)).status).toBe(502);
    expect(calls.putBody).toEqual([]);
  });
});
