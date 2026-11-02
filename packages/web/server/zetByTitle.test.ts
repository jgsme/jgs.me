import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { findZetRkeyByTitle } from "./zetByTitle";

type DB = Parameters<typeof findZetRkeyByTitle>[0];

describe("findZetRkeyByTitle", () => {
  const setup = (
    rows: { rkey: string; date: string; title: string | null }[],
  ): DB => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(
      `CREATE TABLE zet (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        pageID INTEGER NOT NULL,
        rkey TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT
      );`,
    );
    const insert = sqlite.prepare(
      `INSERT INTO zet (pageID, rkey, date, title) VALUES (0, ?, ?, ?)`,
    );
    for (const r of rows) insert.run(r.rkey, r.date, r.title);
    return drizzle(async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const all = stmt.all(...(params as never[])).map((r) => Object.values(r));
      return { rows: method === "get" ? all[0] : all };
    }) as unknown as DB;
  };

  it("題が一致する zet の rkey を返す", async () => {
    const db = setup([
      { rkey: "3abc", date: "2026-10-29", title: "断捨離" },
      { rkey: "3def", date: "2026-10-30", title: "散歩" },
    ]);
    expect(await findZetRkeyByTitle(db, "断捨離")).toBe("3abc");
  });

  it("一致しなければ null", async () => {
    const db = setup([{ rkey: "3abc", date: "2026-10-29", title: null }]);
    expect(await findZetRkeyByTitle(db, "断捨離")).toBeNull();
  });

  // zet.title に unique 制約は無い。重なったら新しい日の方へ飛ばす。
  it("同じ題が複数あれば date の新しい方", async () => {
    const db = setup([
      { rkey: "3old", date: "2026-09-01", title: "断捨離" },
      { rkey: "3new", date: "2026-10-29", title: "断捨離" },
    ]);
    expect(await findZetRkeyByTitle(db, "断捨離")).toBe("3new");
  });
});
