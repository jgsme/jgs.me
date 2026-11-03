import { describe, expect, it } from "vitest";
import { getDB } from "@/db/getDB";
import { dayWindowQuery } from "./timelineQuery";

// 実行はしない。builder が吐く SQL だけを見る
const db = getDB({} as D1Database);

describe("dayWindowQuery", () => {
  it("day window unions the four day expressions", () => {
    const { sql } = dayWindowQuery(db, 1).toSQL();
    expect(sql).toContain("union");
    expect(sql).toContain("'+9 hours'");
    expect(sql).toContain("coalesce");
  });

  it("page 2 skips the first 10 days and peeks one more", () => {
    const { params } = dayWindowQuery(db, 2).toSQL();
    expect(params).toContain(11);
    expect(params).toContain(10);
  });
});
