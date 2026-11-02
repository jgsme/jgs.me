import { describe, expect, it } from "vitest";
import {
  documentURL,
  ingestDocument,
  type DocumentBodies,
  type DocumentCreateInput,
  type DocumentDeps,
  type DocumentTarget,
  type DocumentUpdateInput,
} from "./document";
import type { DocumentRecord, FetchDocumentResult } from "./documentRecord";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/site.standard.document/${RKEY}`;
const HTML =
  '<html><body><p>本文</p><img src="https://a.example/1.png"></body></html>';
const TITLE_PATH = "/pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2";

const payload = {
  type: ["h-entry"],
  properties: { category: ["document"], "at-uri": [AT_URI] },
};

const record = {
  title: "部屋の CO2",
  path: TITLE_PATH,
  publishedAt: "2026-10-31T03:00:00.000Z",
  updatedAt: null,
  content: { type: "html", html: HTML, spoiler: false, colorScheme: null },
} satisfies DocumentRecord;

type RecordOver = Partial<Omit<DocumentRecord, "content">> & {
  content?: Partial<DocumentRecord["content"]>;
};

const found = (
  over: RecordOver = {},
  cid = "bafy1",
  uri = AT_URI,
): FetchDocumentResult => ({
  ok: true,
  got: {
    uri,
    cid,
    record: {
      ...record,
      ...over,
      content: { ...record.content, ...over.content },
    },
    raw: '{"uri":"x"}',
  },
});

const existing: DocumentTarget = {
  pageID: 42,
  druckID: 9,
  title: "部屋の CO2",
  bodyKey: "html-old",
  cid: "bafyold",
};

function fake(over: Partial<DocumentDeps> = {}) {
  const calls = {
    getRecord: [] as string[],
    putBodies: [] as [string, DocumentBodies][],
    create: [] as DocumentCreateInput[],
    update: [] as DocumentUpdateInput[],
    publish: [] as [number, string][],
    purge: [] as string[][],
  };
  const deps: DocumentDeps = {
    getRecord: async (rkey) => {
      calls.getRecord.push(rkey);
      return found();
    },
    findByAtUri: async () => null,
    findPageIDByTitle: async () => null,
    convert: {
      toText: async () => "本文 [a] #1\n二行目",
      toMarkdown: async () => "# 部屋の CO2\n\n本文",
    },
    putBodies: async (key, bodies) => {
      calls.putBodies.push([key, bodies]);
    },
    create: async (input) => {
      calls.create.push(input);
      return { pageID: 42, druckID: 9 };
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
    newBodyKey: () => "html-new",
    now: () => "2026-11-01T00:00:00.000Z",
    ...over,
  };
  return { deps, calls };
}

const nothingWritten = (calls: ReturnType<typeof fake>["calls"]) => {
  expect(calls.putBodies).toEqual([]);
  expect(calls.create).toEqual([]);
  expect(calls.update).toEqual([]);
  expect(calls.publish).toEqual([]);
  expect(calls.purge).toEqual([]);
};

describe("documentURL", () => {
  it("w.jgs.me の /pages/<題>", () => {
    expect(documentURL("部屋の CO2")).toBe(`https://w.jgs.me${TITLE_PATH}`);
  });
});

describe("ingestDocument: create", () => {
  it("新しい document は R2 に 4 つ書いて page / druck を作り 201", async () => {
    const { deps, calls } = fake();
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(
      "https://w.jgs.me/pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2",
    );
    expect(calls.getRecord).toEqual([RKEY]);
    const [key, bodies] = calls.putBodies[0]!;
    expect(key).toBe("html-new");
    expect(bodies.html).toBe(record.content.html);
    expect(bodies.render.body).toBe(
      '<div class="jgs-html-article"><p>本文</p><img src="https://a.example/1.png"></div>',
    );
    expect(bodies.sb).toBe("部屋の CO2\n本文 [a] #1\n二行目");
    expect(bodies.md).toBe("# 部屋の CO2\n\n本文");
    expect(calls.create[0]).toMatchObject({
      title: "部屋の CO2",
      bodyKey: "html-new",
      atUri: AT_URI,
      cid: "bafy1",
      created: "2026-10-31T03:00:00.000Z",
      updated: "2026-10-31T03:00:00.000Z",
      date: "2026-10-31",
      image: "https://a.example/1.png",
      spoiler: false,
      atproto: '{"uri":"x"}',
      mf2: JSON.stringify(payload),
    });
    expect(calls.publish).toEqual([[42, "create"]]);
    expect(calls.purge).toEqual([["/", "/druck"]]);
  });

  it("派生テキストは前後の空行と CRLF を落として題の下に置く", async () => {
    const { deps, calls } = fake({
      convert: {
        toText: async () => "\r\n本文\r\n二行目\r\n\r\n",
        toMarkdown: async () => "md",
      },
    });
    await ingestDocument(payload, deps);
    expect(calls.putBodies[0]![1].sb).toBe("部屋の CO2\n本文\n二行目");
  });

  it("record に updatedAt があれば create の updated はそれ", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ updatedAt: "2026-11-01T09:00:00.000Z" }),
    });
    await ingestDocument(payload, deps);
    expect(calls.create[0]!.created).toBe("2026-10-31T03:00:00.000Z");
    expect(calls.create[0]!.updated).toBe("2026-11-01T09:00:00.000Z");
  });

  it("spoiler の document は image を持たない", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ content: { spoiler: true } }),
    });
    expect((await ingestDocument(payload, deps)).status).toBe(201);
    expect(calls.create[0]!.image).toBeNull();
    expect(calls.create[0]!.spoiler).toBe(true);
  });

  it("colorScheme は入れ物の style になる", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ content: { colorScheme: "dark" } }),
    });
    await ingestDocument(payload, deps);
    expect(
      calls.putBodies[0]![1].render.body.startsWith(
        '<div class="jgs-html-article" style="color-scheme: dark;">',
      ),
    ).toBe(true);
  });

  it("publish が投げても 201", async () => {
    const { deps, calls } = fake({
      publish: async () => {
        throw new Error("ap down");
      },
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(201);
    expect(calls.create).toHaveLength(1);
  });

  it("purge が投げても 201 で publish はする", async () => {
    const { deps, calls } = fake({
      purge: async () => {
        throw new Error("cf down");
      },
    });
    expect((await ingestDocument(payload, deps)).status).toBe(201);
    expect(calls.publish).toEqual([[42, "create"]]);
  });

  it("putBodies が投げたら 500 で page を作らない", async () => {
    const { deps, calls } = fake({
      putBodies: async () => {
        throw new Error("r2 down");
      },
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "server_error",
      error_description: "failed to store document",
    });
    expect(calls.create).toEqual([]);
    expect(calls.publish).toEqual([]);
  });

  it("create が投げたら 500 で配送しない", async () => {
    const { deps, calls } = fake({
      create: async () => {
        throw new Error("d1 down");
      },
    });
    expect((await ingestDocument(payload, deps)).status).toBe(500);
    expect(calls.publish).toEqual([]);
    expect(calls.purge).toEqual([]);
  });
});

describe("ingestDocument: update", () => {
  it("同じ CID の再送は何も書かずに 200", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => ({ ...existing, cid: "bafy1" }),
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBe(`https://w.jgs.me${TITLE_PATH}`);
    nothingWritten(calls);
  });

  it("CID が変われば同じキーに書き直して 200", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => existing,
      findPageIDByTitle: async () => 42,
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBe(`https://w.jgs.me${TITLE_PATH}`);
    expect(calls.putBodies[0]![0]).toBe("html-old");
    expect(calls.create).toEqual([]);
    expect(calls.update[0]).toMatchObject({
      pageID: 42,
      title: "部屋の CO2",
      updated: "2026-11-01T00:00:00.000Z",
      cid: "bafy1",
      image: "https://a.example/1.png",
      spoiler: false,
      atproto: '{"uri":"x"}',
      mf2: JSON.stringify(payload),
    });
    expect(calls.publish).toEqual([[42, "update"]]);
    expect(calls.purge).toEqual([
      [
        "/",
        "/p/42",
        "/pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2",
        "/d/9",
        "/druck",
      ],
    ]);
  });

  it("update の purge に /a/ で始まるパスを含めない", async () => {
    const { deps, calls } = fake({ findByAtUri: async () => existing });
    await ingestDocument(payload, deps);
    expect(calls.purge[0]!.some((p) => p.startsWith("/a/"))).toBe(false);
  });

  it("record に updatedAt があれば page.updated はそれ", async () => {
    const { deps, calls } = fake({
      getRecord: async () => found({ updatedAt: "2026-11-01T09:00:00.000Z" }),
      findByAtUri: async () => existing,
    });
    await ingestDocument(payload, deps);
    expect(calls.update[0]!.updated).toBe("2026-11-01T09:00:00.000Z");
  });

  it("改題は旧題のパスも purge し、Location は新しい題", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => ({ ...existing, title: "旧題" }),
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBe(`https://w.jgs.me${TITLE_PATH}`);
    expect(calls.update[0]!.title).toBe("部屋の CO2");
    expect(calls.purge[0]).toEqual([
      "/",
      "/p/42",
      TITLE_PATH,
      "/d/9",
      "/druck",
      "/pages/%E6%97%A7%E9%A1%8C",
    ]);
  });

  it("update が投げたら 500 で配送しない", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => existing,
      update: async () => {
        throw new Error("d1 down");
      },
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error_description: "failed to store document",
    });
    expect(calls.publish).toEqual([]);
    expect(calls.purge).toEqual([]);
  });
});

describe("ingestDocument: 題の衝突", () => {
  it("別の page が使っている題は 409 で何も書かない", async () => {
    const { deps, calls } = fake({ findPageIDByTitle: async () => 5 });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "conflict",
      error_description: "title already used: 部屋の CO2",
    });
    nothingWritten(calls);
  });

  it("自分自身が持つ題は衝突にしない", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => existing,
      findPageIDByTitle: async () => 42,
    });
    expect((await ingestDocument(payload, deps)).status).toBe(200);
    expect(calls.update).toHaveLength(1);
  });

  it("改題先が別 page の題なら 409 で update しない", async () => {
    const { deps, calls } = fake({
      findByAtUri: async () => ({ ...existing, title: "旧題" }),
      findPageIDByTitle: async () => 5,
    });
    expect((await ingestDocument(payload, deps)).status).toBe(409);
    nothingWritten(calls);
  });
});

describe("ingestDocument: 失敗", () => {
  it("at-uri が document の collection でなければ 400 で PDS を引かない", async () => {
    const { deps, calls } = fake();
    const res = await ingestDocument(
      {
        properties: {
          category: ["document"],
          "at-uri": [`at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`],
        },
      },
      deps,
    );
    expect(res.status).toBe(400);
    expect(calls.getRecord).toEqual([]);
  });

  it("PDS が別の record を返したら 502 で何も書かない", async () => {
    const other = `at://did:web:ds.jgs.me/site.standard.document/3m2zzzzzzzzzz`;
    const { deps, calls } = fake({
      getRecord: async () => found({}, "bafy1", other),
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "server_error",
      error_description: `pds returned another record: ${other}`,
    });
    nothingWritten(calls);
  });

  it("PDS の 400 はそのまま 400", async () => {
    const { deps, calls } = fake({
      getRecord: async () => ({
        ok: false,
        status: 400,
        description: `record not found: ${RKEY}`,
      }),
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_request",
      error_description: `record not found: ${RKEY}`,
    });
    nothingWritten(calls);
  });

  it("toMarkdown が失敗したら 502 で何も書かない", async () => {
    const { deps, calls } = fake({
      convert: {
        toText: async () => "本文",
        toMarkdown: async () => {
          throw new Error("ai down");
        },
      },
    });
    const res = await ingestDocument(payload, deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      error_description: "failed to convert html: ai down",
    });
    nothingWritten(calls);
  });

  it("toText が失敗しても 502 で何も書かない", async () => {
    const { deps, calls } = fake({
      convert: {
        toText: async () => {
          throw new Error("ai down");
        },
        toMarkdown: async () => "md",
      },
    });
    expect((await ingestDocument(payload, deps)).status).toBe(502);
    nothingWritten(calls);
  });
});
