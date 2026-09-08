import { describe, expect, it } from "vitest";
import { buildKindUpdateSql } from "./kindSql.ts";

describe("buildKindUpdateSql", () => {
  it("kind ごとにまとめて 1 文にする", () => {
    const sql = buildKindUpdateSql([
      { id: 1, kind: "quote" },
      { id: 2, kind: "photo" },
      { id: 3, kind: "quote" },
    ]);
    expect(sql).toBe(
      "UPDATE clip SET kind = 'photo' WHERE pageID IN (2);\n" +
        "UPDATE clip SET kind = 'quote' WHERE pageID IN (1, 3);",
    );
  });

  it("1 種類だけなら 1 文", () => {
    expect(buildKindUpdateSql([{ id: 7, kind: "link" }])).toBe(
      "UPDATE clip SET kind = 'link' WHERE pageID IN (7);",
    );
  });

  it("空なら投げる", () => {
    expect(() => buildKindUpdateSql([])).toThrow();
  });

  it("正の整数でない id は投げる", () => {
    expect(() => buildKindUpdateSql([{ id: 0, kind: "link" }])).toThrow();
  });
});
