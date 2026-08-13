import { describe, expect, it } from "vitest";
import { buildDeleteSql, buildSelectSql, TARGET_TABLES } from "./sql.ts";

describe("TARGET_TABLES", () => {
  it("削除対象は 3 テーブル", () => {
    expect(TARGET_TABLES).toEqual(["article", "clip", "excluded_page"]);
  });
});

describe("buildSelectSql", () => {
  it("在籍状況を相関サブクエリ 3 本で取る 1 文を返す", () => {
    expect(buildSelectSql([6216])).toBe(
      [
        "SELECT p.id, p.title,",
        "  (SELECT COUNT(*) FROM article WHERE pageID = p.id) AS in_article,",
        "  (SELECT COUNT(*) FROM clip WHERE pageID = p.id) AS in_clip,",
        "  (SELECT COUNT(*) FROM excluded_page WHERE pageID = p.id) AS in_excluded",
        "FROM page p WHERE p.id IN (6216)",
      ].join("\n"),
    );
  });

  it("複数 ID をカンマ区切りで埋め込む", () => {
    expect(buildSelectSql([6216, 6217])).toContain(
      "FROM page p WHERE p.id IN (6216, 6217)",
    );
  });

  it("ID が空なら例外を投げる", () => {
    expect(() => buildSelectSql([])).toThrow();
  });

  it("整数でない ID / 0 以下の ID は例外を投げる", () => {
    expect(() => buildSelectSql([1.5])).toThrow();
    expect(() => buildSelectSql([0])).toThrow();
    expect(() => buildSelectSql([-1])).toThrow();
  });
});

describe("buildDeleteSql", () => {
  it("1 テーブル分の DELETE を返す", () => {
    expect(buildDeleteSql("article", [6216])).toBe(
      "DELETE FROM article WHERE pageID IN (6216)",
    );
  });

  it("複数 ID をカンマ区切りで埋め込む", () => {
    expect(buildDeleteSql("clip", [6216, 6217])).toBe(
      "DELETE FROM clip WHERE pageID IN (6216, 6217)",
    );
  });

  it("TARGET_TABLES のどのテーブルでも正しいテーブル名を使う", () => {
    expect(TARGET_TABLES.map((table) => buildDeleteSql(table, [1]))).toEqual([
      "DELETE FROM article WHERE pageID IN (1)",
      "DELETE FROM clip WHERE pageID IN (1)",
      "DELETE FROM excluded_page WHERE pageID IN (1)",
    ]);
  });

  it("ID が空なら例外を投げる", () => {
    expect(() => buildDeleteSql("article", [])).toThrow();
  });

  it("整数でない ID / 0 以下の ID は例外を投げる", () => {
    expect(() => buildDeleteSql("article", [1.5])).toThrow();
    expect(() => buildDeleteSql("article", [0])).toThrow();
    expect(() => buildDeleteSql("article", [-1])).toThrow();
  });
});
