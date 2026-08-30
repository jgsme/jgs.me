import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { pages } from "@jigsaw/db";
import { pickUniqueTitle, titleFilter } from "./uniqueTitle";

describe("pickUniqueTitle", () => {
  it("重複していなければ base をそのまま返す", () => {
    expect(pickUniqueTitle("題", new Set())).toBe("題");
  });

  it("base が使われていたら (1) を付ける", () => {
    expect(pickUniqueTitle("題", new Set(["題"]))).toBe("題 (1)");
  });

  it("(1) も使われていたら (2) に進む", () => {
    expect(pickUniqueTitle("題", new Set(["題", "題 (1)"]))).toBe("題 (2)");
  });

  // 途中が空いていたらそこを埋める。常に最大値 +1 にすると番号が無駄に伸びる。
  it("途中が空いていればその番号を使う", () => {
    expect(pickUniqueTitle("題", new Set(["題", "題 (2)"]))).toBe("題 (1)");
  });

  // 別の題の suffix 付きが existing に混ざっても base の採番には影響しない。
  it("無関係な題が集合にあっても base をそのまま返す", () => {
    expect(pickUniqueTitle("題", new Set(["別の題", "別の題 (1)"]))).toBe("題");
  });

  it("空文字の base でも落ちない", () => {
    expect(pickUniqueTitle("", new Set([""]))).toBe(" (1)");
  });
});

describe("titleFilter", () => {
  // D1 の LIKE は 50 バイトを超えるパターンを弾く
  // ("LIKE or GLOB pattern too complex")。日本語の題は 1 文字 3 バイトなので
  // 16 文字ほどで超える。前方一致に LIKE を使ってはいけない。
  it("LIKE を使わない", () => {
    const db = drizzle({} as D1Database);
    const { sql } = db
      .select({ title: pages.title })
      .from(pages)
      .where(titleFilter("名探偵プリキュア 31話 感想 (ネタバレあり)"))
      .toSQL();

    expect(sql.toLowerCase()).not.toContain("like");
  });

  // '(' の次の文字は ')' なので [base + " (", base + " )") がちょうど
  // "base (…" の範囲になる。
  it("範囲の境界が base の suffix 付きだけを含む", () => {
    const db = drizzle({} as D1Database);
    const { params } = db
      .select({ title: pages.title })
      .from(pages)
      .where(titleFilter("題"))
      .toSQL();

    expect(params).toEqual(["題", "題 (", "題 )"]);
  });
});
