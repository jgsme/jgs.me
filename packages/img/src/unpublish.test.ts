import { describe, expect, it } from "vitest";
import { unpublish, type UnpublishDeps } from "./unpublish";

const ID = "a".repeat(64);

function deps(hasRow: boolean, object: { ext: string; bytes: number } | null) {
  const marked: string[] = [];
  const tombstones: { id: string; ext: string; bytes: number }[] = [];
  const d: UnpublishDeps = {
    markDeleted: async (id) => {
      marked.push(id);
      return hasRow;
    },
    findObject: async () =>
      object && { ...object, created: "2026-09-04 12:00:00" },
    insertTombstone: async (row) => {
      tombstones.push(row);
    },
  };
  return { deps: d, marked, tombstones };
}

describe("unpublish", () => {
  it("行があれば消した印を付けるだけ", async () => {
    const {
      deps: d,
      marked,
      tombstones,
    } = deps(true, {
      ext: "png",
      bytes: 5,
    });
    await unpublish(ID, d);
    expect(marked).toEqual([ID]);
    expect(tombstones).toEqual([]);
  });

  // 行の無い画像も R2 フォールバックでページになっている。行を作らないと
  // 消したことを覚えておけない。
  it("行が無く R2 にあれば、消した印付きの行を作る", async () => {
    const { deps: d, tombstones } = deps(false, { ext: "jpg", bytes: 42 });
    await unpublish(ID, d);
    expect(tombstones).toEqual([{ id: ID, ext: "jpg", bytes: 42 }]);
  });

  it("どちらにも無ければ何もしない", async () => {
    const { deps: d, tombstones } = deps(false, null);
    await unpublish(ID, d);
    expect(tombstones).toEqual([]);
  });
});
