import { describe, expect, it } from "vitest";
import { buildSql, TARGET_TABLES } from "./sql.ts";

describe("TARGET_TABLES", () => {
  it("削除対象は 3 テーブル", () => {
    expect(TARGET_TABLES).toEqual(["article", "clip", "excluded_page"]);
  });
});

describe("buildSql", () => {
  it("SELECT 4 本と DELETE 3 本を決まった順で返す", () => {
    const statements = buildSql([1613])
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    expect(statements).toEqual([
      "SELECT id, title FROM page WHERE id IN (1613)",
      "SELECT pageID FROM article WHERE pageID IN (1613)",
      "SELECT pageID FROM clip WHERE pageID IN (1613)",
      "SELECT pageID FROM excluded_page WHERE pageID IN (1613)",
      "DELETE FROM article WHERE pageID IN (1613)",
      "DELETE FROM clip WHERE pageID IN (1613)",
      "DELETE FROM excluded_page WHERE pageID IN (1613)",
    ]);
  });

  it("複数 ID をカンマ区切りで埋め込む", () => {
    expect(buildSql([1613, 1612])).toContain(
      "SELECT id, title FROM page WHERE id IN (1613, 1612)",
    );
  });

  it("ID が空なら例外を投げる", () => {
    expect(() => buildSql([])).toThrow();
  });

  it("整数でない ID は例外を投げる", () => {
    expect(() => buildSql([1.5])).toThrow();
  });
});
