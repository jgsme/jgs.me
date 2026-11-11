import { describe, expect, it, vi } from "vitest";
import {
  createDraft,
  draftURL,
  updateDraft,
  type DraftDeps,
  type DraftRow,
} from "./draft";
import type { UpdateAction } from "./mf2update";

const KEY = "A".repeat(43);
const payload = {
  type: ["h-entry"],
  properties: {
    name: ["題"],
    content: ["本文"],
    "post-status": ["draft"],
  },
};

const row: DraftRow = {
  id: 7,
  key: KEY,
  title: "題",
  bodyKey: "sb-old",
  mf2: JSON.stringify(payload),
};

const action = (over: Partial<UpdateAction> = {}): UpdateAction => ({
  url: `https://w.jgs.me/drafts/${KEY}`,
  replace: {},
  add: {},
  deleteProps: [],
  deleteValues: {},
  silent: false,
  ...over,
});

// 非同期の I/O deps だけを calls に記録する。newKey / newBodyKey / now は記録しない。
function fakeDeps(over: Partial<DraftDeps> = {}) {
  const calls: string[] = [];
  const state: {
    put?: { bodyKey: string; body: string };
    inserted?: Parameters<DraftDeps["insert"]>[0];
    updated?: Parameters<DraftDeps["update"]>[0];
  } = {};
  const deps: DraftDeps = {
    newKey: () => KEY,
    newBodyKey: () => "sb-1",
    now: () => "2026-11-10T00:00:00.000Z",
    putBody: async (bodyKey, body) => {
      calls.push("putBody");
      state.put = { bodyKey, body };
    },
    insert: async (input) => {
      calls.push("insert");
      state.inserted = input;
    },
    findByKey: async () => {
      calls.push("findByKey");
      return row;
    },
    update: async (input) => {
      calls.push("update");
      state.updated = input;
    },
    titleTaken: async () => {
      calls.push("titleTaken");
      return false;
    },
    publish: async () => {
      calls.push("publish");
      return 1;
    },
    putMd: async () => {
      calls.push("putMd");
    },
    notify: async () => {
      calls.push("notify");
    },
    ...over,
  };
  return { deps, calls, state };
}

const writes = (calls: string[]) =>
  calls.filter((c) => c === "putBody" || c === "insert" || c === "update");
const published = (calls: string[]) =>
  calls.filter((c) => ["publish", "putMd", "notify", "titleTaken"].includes(c));

describe("draftURL", () => {
  it("w.jgs.me の /drafts/<鍵>", () => {
    expect(draftURL(KEY)).toBe(`https://w.jgs.me/drafts/${KEY}`);
  });
});

describe("createDraft", () => {
  it("create: 本文を書いてから行を入れ、201 と /drafts/<鍵> を返す", async () => {
    const { deps, calls, state } = fakeDeps();
    const res = await createDraft(payload, deps);
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`https://w.jgs.me/drafts/${KEY}`);
    expect(calls).toEqual(["putBody", "insert"]);
    expect(state.put).toEqual({ bodyKey: "sb-1", body: "題\n本文" });
    expect(state.inserted).toMatchObject({
      key: KEY,
      title: "題",
      bodyKey: "sb-1",
      spoiler: false,
      created: "2026-11-10T00:00:00.000Z",
    });
    expect(JSON.parse(state.inserted!.mf2)).toEqual(payload);
  });

  it("create: 配信・検索・公開の deps を 1 つも呼ばない", async () => {
    const { deps, calls } = fakeDeps();
    await createDraft(payload, deps);
    expect(published(calls)).toEqual([]);
  });

  it("create: name が無ければ 400 で何も書かない", async () => {
    const { deps, calls } = fakeDeps();
    const res = await createDraft(
      { type: ["h-entry"], properties: { content: ["本文"] } },
      deps,
    );
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("create: clip は 400 で何も書かない", async () => {
    const { deps, calls } = fakeDeps();
    const res = await createDraft(
      {
        type: ["h-entry"],
        properties: { ...payload.properties, category: ["clip"] },
      },
      deps,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: "a clip cannot be a draft",
    });
    expect(calls).toEqual([]);
  });

  it("create: spoiler を行に持つ", async () => {
    const { deps, state } = fakeDeps();
    await createDraft(
      {
        type: ["h-entry"],
        properties: { ...payload.properties, spoiler: ["true"] },
      },
      deps,
    );
    expect(state.inserted!.spoiler).toBe(true);
  });
});

describe("updateDraft", () => {
  it("update: 鍵が無ければ 404 で、公開済みかもしれないと分かる", async () => {
    const res = await updateDraft(
      action({ replace: { content: ["新"] } }),
      KEY,
      fakeDeps({ findByKey: async () => null }).deps,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error_description: expect.stringContaining("already be published"),
    });
  });

  it("update: 同じ bodyKey に本文を書き直し、行を更新して 204。Location は無い", async () => {
    const { deps, calls, state } = fakeDeps();
    const res = await updateDraft(
      action({ replace: { content: ["新"] } }),
      KEY,
      deps,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Location")).toBeNull();
    expect(calls).toEqual(["findByKey", "putBody", "update"]);
    expect(state.put).toEqual({ bodyKey: "sb-old", body: "題\n新" });
    const mf2 = JSON.parse(state.updated!.mf2);
    expect(mf2.properties.content).toEqual(["新"]);
    expect(mf2.properties["post-status"]).toEqual(["draft"]);
    expect(state.updated).toMatchObject({
      id: 7,
      title: "題",
      spoiler: false,
      updated: "2026-11-10T00:00:00.000Z",
    });
  });

  it("update: 改題しても 204 (URL は鍵なので変わらない)", async () => {
    const { deps, state } = fakeDeps();
    const res = await updateDraft(
      action({ replace: { name: ["新題"] } }),
      KEY,
      deps,
    );
    expect(res.status).toBe(204);
    expect(state.updated!.title).toBe("新題");
    expect(state.put!.body.split("\n")[0]).toBe("新題");
  });

  it("update: mp-silent が付いていても同じ", async () => {
    const { deps, calls, state } = fakeDeps();
    const res = await updateDraft(
      action({ replace: { content: ["新"] }, silent: true }),
      KEY,
      deps,
    );
    expect(res.status).toBe(204);
    expect(calls).toEqual(["findByKey", "putBody", "update"]);
    expect(state.put!.body).toBe("題\n新");
  });

  it("update: 題を消す update は 400 で何も書かない", async () => {
    const { deps, calls } = fakeDeps();
    const res = await updateDraft(action({ deleteProps: ["name"] }), KEY, deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: expect.stringContaining(
        "update would break the entry",
      ),
    });
    expect(writes(calls)).toEqual([]);
  });

  it("update: clip にする update は 400 で何も書かない", async () => {
    const { deps, calls } = fakeDeps();
    const res = await updateDraft(
      action({ add: { category: ["clip"] } }),
      KEY,
      deps,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: "a clip cannot be a draft",
    });
    expect(writes(calls)).toEqual([]);
  });

  it("update: post-status が読めない値なら 400", async () => {
    const { deps, calls } = fakeDeps();
    const res = await updateDraft(
      action({ replace: { "post-status": ["private"] } }),
      KEY,
      deps,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: "post-status must be draft or published",
    });
    expect(writes(calls)).toEqual([]);
  });

  it("update: 保存してある mf2 が壊れていたら 500 で何も書かない", async () => {
    const { deps, calls } = fakeDeps({
      findByKey: async () => ({ ...row, mf2: "{" }),
    });
    const res = await updateDraft(
      action({ replace: { content: ["新"] } }),
      KEY,
      deps,
    );
    expect(res.status).toBe(500);
    expect(writes(calls)).toEqual([]);
  });

  it("update: publish / putMd / notify を呼ばない", async () => {
    const { deps, calls } = fakeDeps();
    await updateDraft(action({ replace: { content: ["新"] } }), KEY, deps);
    expect(published(calls)).toEqual([]);
  });

  describe("公開", () => {
    const publishAction = action({ replace: { "post-status": ["published"] } });

    function publishDeps(over: Partial<DraftDeps> = {}) {
      const rec: { input?: Parameters<DraftDeps["publish"]>[0] } = {};
      const f = fakeDeps({
        publish: async (input) => {
          f.calls.push("publish");
          rec.input = input;
          return 42;
        },
        ...over,
      });
      return { ...f, rec };
    }

    it("公開: 保存してある内容で publish し、201 と /pages/<題> を返す", async () => {
      const { deps, calls, rec } = publishDeps();
      const res = await updateDraft(publishAction, KEY, deps);
      expect(res.status).toBe(201);
      expect(res.headers.get("Location")).toBe(
        "https://w.jgs.me/pages/%E9%A1%8C",
      );
      expect(calls).toEqual([
        "findByKey",
        "titleTaken",
        "putBody",
        "publish",
        "putMd",
        "notify",
      ]);
      expect(rec.input).toMatchObject({
        draftID: row.id,
        title: "題",
        bodyKey: row.bodyKey,
        body: "題\n本文",
        spoiler: false,
        created: "2026-11-10T00:00:00.000Z",
        date: "2026-11-10",
      });
    });

    it("公開: object に残す mf2 から post-status を落とす", async () => {
      const { deps, rec } = publishDeps();
      await updateDraft(publishAction, KEY, deps);
      const props = JSON.parse(rec.input!.mf2).properties;
      expect(props).not.toHaveProperty("post-status");
      expect(props.name).toEqual(["題"]);
      expect(props.content).toEqual(["本文"]);
    });

    it("公開: 日付は公開した時刻の JST の暦日", async () => {
      const { deps, rec } = publishDeps({
        now: () => "2026-11-10T16:00:00.000Z",
      });
      await updateDraft(publishAction, KEY, deps);
      expect(rec.input).toMatchObject({
        created: "2026-11-10T16:00:00.000Z",
        date: "2026-11-11",
      });
    });

    it("公開: 題が衝突したら 409 で、putBody も publish も呼ばない", async () => {
      const { deps, calls } = publishDeps({
        titleTaken: async () => {
          calls.push("titleTaken");
          return true;
        },
      });
      const res = await updateDraft(publishAction, KEY, deps);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        error_description: "title already in use: 題",
      });
      expect(calls).toEqual(["findByKey", "titleTaken"]);
    });

    it("公開: notify に publish が返した pageID を渡す", async () => {
      const ids: number[] = [];
      const { deps } = publishDeps({
        notify: async (id) => {
          ids.push(id);
        },
      });
      await updateDraft(publishAction, KEY, deps);
      expect(ids).toEqual([42]);
    });

    it("公開: putMd が落ちても 201 (ログだけ残す)", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { deps, calls } = publishDeps({
        putMd: async () => {
          calls.push("putMd");
          throw new Error("r2 down");
        },
      });
      const res = await updateDraft(publishAction, KEY, deps);
      expect(res.status).toBe(201);
      expect(calls).toContain("notify");
      expect(err).toHaveBeenCalledTimes(1);
      expect(err.mock.calls[0][0]).toContain("r2 down");
      err.mockRestore();
    });

    it("公開: notify が落ちても 201 (ログだけ残す)", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { deps } = publishDeps({
        notify: async () => {
          throw new Error("queue down");
        },
      });
      const res = await updateDraft(publishAction, KEY, deps);
      expect(res.status).toBe(201);
      expect(err).toHaveBeenCalledTimes(1);
      expect(err.mock.calls[0][0]).toContain("queue down");
      err.mockRestore();
    });

    it("公開: 同じ update に本文の replace があれば、それを当てた内容で公開する", async () => {
      const { deps, state, rec } = publishDeps();
      await updateDraft(
        action({
          replace: { content: ["新"], "post-status": ["published"] },
        }),
        KEY,
        deps,
      );
      expect(rec.input!.body).toBe("題\n新");
      expect(state.put).toEqual({ bodyKey: "sb-old", body: "題\n新" });
    });

    it("公開: update (行の更新) は呼ばない", async () => {
      const { deps, calls } = publishDeps();
      await updateDraft(publishAction, KEY, deps);
      expect(calls).not.toContain("update");
    });
  });
});
