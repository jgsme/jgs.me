import { describe, expect, it } from "vitest";
import {
  runMdBackfill,
  type MdBackfillDeps,
  type MdBackfillRow,
} from "./mdBackfill";
import type { MdPut } from "./mdBody";

const row = (over: Partial<MdBackfillRow> = {}): MdBackfillRow => {
  const id = over.id ?? 1;
  return { id, title: `題${id}`, bodyKey: `sb-${id}`, ...over };
};

function deps(rows: MdBackfillRow[], bodies: Record<string, string>) {
  const written: Record<string, MdPut> = {};
  const d: MdBackfillDeps = {
    listPages: async (cursor, limit) =>
      rows.filter((r) => r.id > cursor).slice(0, limit),
    readBody: async (bodyKey) => bodies[bodyKey] ?? null,
    writeMd: async (put) => {
      written[put.key] = put;
    },
  };
  return { deps: d, written };
}

describe("runMdBackfill", () => {
  it("本文を md にして書く", async () => {
    const { deps: d, written } = deps([row()], { "sb-1": "題\n本文" });

    const r = await runMdBackfill(d, 0, 20);

    expect(written["sb-1.md"]).toEqual({
      key: "sb-1.md",
      body: "# 題\n\n本文",
      contentType: "text/markdown; charset=utf-8",
    });
    expect(r.items[0]).toEqual({ pageId: 1, title: "題1", written: true });
  });

  // 本文が無いページで止めない。R2 に無いキーを指す page は実在する
  // (fetchBody も [R2 miss] を吐いて null を返すだけ)。
  it("本文が読めないページは書かずに続ける", async () => {
    const { deps: d, written } = deps([row({ id: 1 }), row({ id: 2 })], {
      "sb-1": "題\n本文",
    });

    const r = await runMdBackfill(d, 0, 20);

    expect(Object.keys(written)).toEqual(["sb-1.md"]);
    expect(r.items[1]).toEqual({ pageId: 2, title: "題2", written: false });
    expect(r.processed).toBe(2);
  });

  // runScan / runRewrite と同じ理由。1 件の例外でリクエストごと 500 にすると
  // nextCursor が返らず、CLI は同じ cursor で毎回そこで止まる。
  it("書き込みが落ちてもバッチを止めない", async () => {
    const { deps: d } = deps([row({ id: 1 }), row({ id: 2 })], {
      "sb-1": "題\n本文",
      "sb-2": "題\n本文",
    });
    d.writeMd = async (put) => {
      if (put.key === "sb-1.md") throw new Error("boom");
    };

    const r = await runMdBackfill(d, 0, 20);

    expect(r.items[0]!.error).toBe("boom");
    expect(r.items[1]!.written).toBe(true);
  });

  it("limit まで埋まったら最後の id を next cursor にする", async () => {
    const rows = [row({ id: 1 }), row({ id: 2 })];
    const { deps: d } = deps(rows, { "sb-1": "題\n本文", "sb-2": "題\n本文" });

    expect((await runMdBackfill(d, 0, 2)).nextCursor).toBe(2);
  });

  it("limit に満たなければ終わり", async () => {
    const { deps: d } = deps([row({ id: 1 })], { "sb-1": "題\n本文" });

    expect((await runMdBackfill(d, 0, 20)).nextCursor).toBeNull();
  });

  it("1 件も返らなければ終わり", async () => {
    const { deps: d } = deps([], {});

    const r = await runMdBackfill(d, 0, 20);

    expect(r.nextCursor).toBeNull();
    expect(r.processed).toBe(0);
  });
});
