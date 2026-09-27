import { describe, expect, it } from "vitest";
import { findObject } from "./media";

const ID = "a".repeat(64);

function bucket(objects: { key: string; size: number; uploaded: Date }[]) {
  const prefixes: string[] = [];
  const b = {
    list: async (opts: { prefix: string }) => {
      prefixes.push(opts.prefix);
      return {
        objects: objects.filter((o) => o.key.startsWith(opts.prefix)),
      };
    },
  } as unknown as R2Bucket;
  return { bucket: b, prefixes };
}

describe("findObject", () => {
  it("<id>. で前方一致して ext と大きさと日時を返す", async () => {
    const { bucket: b, prefixes } = bucket([
      {
        key: `${ID}.jpg`,
        size: 42,
        uploaded: new Date("2026-09-04T12:34:56.789Z"),
      },
    ]);

    expect(await findObject(b, ID)).toEqual({
      ext: "jpg",
      bytes: 42,
      created: "2026-09-04 12:34:56",
    });
    // "." まで含めないと、id を接頭辞に持つ別のキーに当たりうる。
    expect(prefixes).toEqual([`${ID}.`]);
  });

  it("無ければ null", async () => {
    const { bucket: b } = bucket([]);
    expect(await findObject(b, ID)).toBeNull();
  });
});
