import { describe, expect, it } from "vitest";
import {
  runLinkIndex,
  type LinkIndexDeps,
  type LinkPageRow,
} from "./linkIndex";

function deps(
  rows: LinkPageRow[],
  bodies: Record<string, string | null>,
  written: Array<{ pageID: number; toTitles: string[] }>,
): LinkIndexDeps {
  return {
    listPages: async (cursor, limit) =>
      rows.filter((r) => r.id > cursor).slice(0, limit),
    readBody: async (bodyKey) => bodies[bodyKey] ?? null,
    replaceLinks: async (pageID, toTitles) => {
      written.push({ pageID, toTitles });
    },
  };
}

describe("runLinkIndex", () => {
  it("各ページのリンクを replaceLinks に渡す", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(
      deps(
        [{ id: 1, title: "A", bodyKey: "k1" }],
        { k1: "A\n[foo] と [bar]" },
        written,
      ),
      0,
      10,
    );

    expect(written).toEqual([{ pageID: 1, toTitles: ["foo", "bar"] }]);
    expect(res.processed).toBe(1);
    expect(res.items[0]).toEqual({ pageId: 1, title: "A", links: 2 });
  });

  it("リンク 0 件のページでも replaceLinks を呼ぶ (古い索引を消すため)", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    await runLinkIndex(
      deps([{ id: 1, title: "A", bodyKey: "k1" }], { k1: "A\n本文" }, written),
      0,
      10,
    );

    expect(written).toEqual([{ pageID: 1, toTitles: [] }]);
  });

  it("本文が読めないページは飛ばして error を残す", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(
      deps([{ id: 1, title: "A", bodyKey: "k1" }], { k1: null }, written),
      0,
      10,
    );

    expect(written).toEqual([]);
    expect(res.items[0]?.error).toBe("body not found");
  });

  it("limit まで埋まったら nextCursor に最後の id を返す", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(
      deps(
        [
          { id: 1, title: "A", bodyKey: "k1" },
          { id: 2, title: "B", bodyKey: "k2" },
        ],
        { k1: "A", k2: "B" },
        written,
      ),
      0,
      2,
    );

    expect(res.nextCursor).toBe(2);
  });

  it("limit に届かなければ nextCursor は null", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(
      deps([{ id: 1, title: "A", bodyKey: "k1" }], { k1: "A" }, written),
      0,
      10,
    );

    expect(res.nextCursor).toBeNull();
  });

  it("対象が 0 件なら nextCursor は null", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(deps([], {}, written), 0, 10);

    expect(res.processed).toBe(0);
    expect(res.nextCursor).toBeNull();
  });

  it("1 ページの失敗でバッチ全体を止めない", async () => {
    const written: Array<{ pageID: number; toTitles: string[] }> = [];
    const res = await runLinkIndex(
      {
        listPages: async () => [
          { id: 1, title: "A", bodyKey: "k1" },
          { id: 2, title: "B", bodyKey: "k2" },
        ],
        readBody: async (bodyKey) => {
          if (bodyKey === "k1") throw new Error("boom");
          return "B\n[foo]";
        },
        replaceLinks: async (pageID, toTitles) => {
          written.push({ pageID, toTitles });
        },
      },
      0,
      10,
    );

    expect(res.items[0]?.error).toBe("boom");
    expect(written).toEqual([{ pageID: 2, toTitles: ["foo"] }]);
  });
});
