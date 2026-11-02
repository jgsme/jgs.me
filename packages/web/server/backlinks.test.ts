import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { fetchBacklinks } from "./backlinks";

type DB = Parameters<typeof fetchBacklinks>[0];

describe("fetchBacklinks", () => {
  // links は「このページが本文でリンクしている題」。
  const setup = (
    rows: {
      title: string;
      updated: string;
      as: "article" | "clip" | "none";
      links: string[];
      // zet なら record の title (null は題なし)。
      zetTitle?: string | null;
    }[],
  ): DB => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(
      `CREATE TABLE page (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        updated TEXT NOT NULL,
        image TEXT
      );
      CREATE TABLE article (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        pageID INTEGER NOT NULL
      );
      CREATE TABLE clip (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        pageID INTEGER NOT NULL
      );
      CREATE TABLE zet (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        pageID INTEGER NOT NULL,
        title TEXT
      );
      CREATE TABLE page_link (
        fromPageID INTEGER NOT NULL,
        toTitle TEXT NOT NULL,
        PRIMARY KEY (fromPageID, toTitle)
      );`,
    );
    const insertPage = sqlite.prepare(
      `INSERT INTO page (title, updated) VALUES (?, ?)`,
    );
    const insertArticle = sqlite.prepare(
      `INSERT INTO article (pageID) VALUES (?)`,
    );
    const insertClip = sqlite.prepare(`INSERT INTO clip (pageID) VALUES (?)`);
    const insertZet = sqlite.prepare(
      `INSERT INTO zet (pageID, title) VALUES (?, ?)`,
    );
    const insertLink = sqlite.prepare(
      `INSERT INTO page_link (fromPageID, toTitle) VALUES (?, ?)`,
    );
    for (const row of rows) {
      const { lastInsertRowid } = insertPage.run(row.title, row.updated);
      if (row.as === "article") insertArticle.run(lastInsertRowid);
      if (row.as === "clip") insertClip.run(lastInsertRowid);
      if (row.zetTitle !== undefined)
        insertZet.run(lastInsertRowid, row.zetTitle);
      for (const to of row.links) insertLink.run(lastInsertRowid, to);
    }

    return drizzle(async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const all = stmt.all(...(params as never[])).map((r) => Object.values(r));
      return { rows: method === "get" ? all[0] : all };
    }) as unknown as DB;
  };

  const titles = (r: Awaited<ReturnType<typeof fetchBacklinks>>) =>
    r.backlinks.map((b) => b.title);

  it("その題にリンクしている article と clip を新しい順に返す", async () => {
    const db = setup([
      {
        title: "古い記事",
        updated: "2026-01-01",
        as: "article",
        links: ["猫"],
      },
      { title: "新しいclip", updated: "2026-02-01", as: "clip", links: ["猫"] },
      { title: "下書き", updated: "2026-03-01", as: "none", links: ["猫"] },
      { title: "無関係", updated: "2026-04-01", as: "article", links: ["犬"] },
    ]);
    expect(titles(await fetchBacklinks(db, "猫", 0, 12))).toEqual([
      "新しいclip",
      "古い記事",
    ]);
  });

  // clip のページにも被リンクを出す。本文で自分の題にリンクしていると、
  // 自分自身がカードに出てしまう。
  it("自分の題へのリンクは返さない", async () => {
    const db = setup([
      { title: "猫", updated: "2026-02-01", as: "clip", links: ["猫"] },
      { title: "猫の話", updated: "2026-01-01", as: "article", links: ["猫"] },
    ]);
    expect(titles(await fetchBacklinks(db, "猫", 0, 12))).toEqual(["猫の話"]);
  });

  // 本文は zet を題 (zet.title) でリンクするが、zet の page.title は
  // zet:<rkey>。題宛てのリンクも zet の被リンクとして拾う。
  it("zet のページには zet の題宛てのリンクも返す", async () => {
    const db = setup([
      {
        title: "zet:3abc",
        updated: "2026-01-01",
        as: "none",
        links: [],
        zetTitle: "断捨離",
      },
      {
        title: "題で書いた",
        updated: "2026-03-01",
        as: "article",
        links: ["断捨離"],
      },
      {
        title: "rkey で書いた",
        updated: "2026-02-01",
        as: "clip",
        links: ["zet:3abc"],
      },
      { title: "無関係", updated: "2026-04-01", as: "article", links: ["猫"] },
    ]);
    expect(titles(await fetchBacklinks(db, "zet:3abc", 0, 12))).toEqual([
      "題で書いた",
      "rkey で書いた",
    ]);
  });

  it("題の無い zet は zet:<rkey> 宛てのリンクだけ返す", async () => {
    const db = setup([
      {
        title: "zet:3abc",
        updated: "2026-01-01",
        as: "none",
        links: [],
        zetTitle: null,
      },
      {
        title: "rkey で書いた",
        updated: "2026-02-01",
        as: "clip",
        links: ["zet:3abc"],
      },
    ]);
    expect(titles(await fetchBacklinks(db, "zet:3abc", 0, 12))).toEqual([
      "rkey で書いた",
    ]);
  });
});
