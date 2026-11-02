import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import {
  documentCreateStatements,
  documentUpdateStatements,
} from "./documentStore";
import type { DocumentCreateInput, DocumentUpdateInput } from "./document";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/site.standard.document/${RKEY}`;

// toSQL() は D1 を叩かない。文の形と束縛値だけを固定する。
const db = drizzle({} as D1Database);
const sqlOf = (s: unknown) =>
  (s as { toSQL(): { sql: string; params: unknown[] } }).toSQL();

const createInput: DocumentCreateInput = {
  title: "部屋の CO2",
  image: null,
  spoiler: false,
  cid: "bafy1",
  atproto: '{"uri":"x"}',
  mf2: "{}",
  bodyKey: "html-new",
  atUri: AT_URI,
  created: "2026-10-31T03:00:00.000Z",
  updated: "2026-10-31T03:00:00.000Z",
  date: "2026-10-31",
};

const updateInput: DocumentUpdateInput = {
  pageID: 42,
  title: "改題",
  image: "https://a.example/1.png",
  spoiler: true,
  cid: "bafy2",
  atproto: "{}",
  mf2: "{}",
  updated: "2026-11-01T00:00:00.000Z",
};

describe("documentCreateStatements", () => {
  it("page / druck / object / copy の順に 1 batch", () => {
    expect(
      documentCreateStatements(db, createInput)
        .map(sqlOf)
        .map((s) => s.sql.split(" (")[0]),
    ).toEqual([
      'insert into "page"',
      'insert into "druck"',
      'insert into "object"',
      'insert into "copy"',
    ]);
  });

  it("page は bodyKey / created / updated / image / spoiler を持つ", () => {
    expect(sqlOf(documentCreateStatements(db, createInput)[0]).params).toEqual(
      expect.arrayContaining([
        "部屋の CO2",
        "html-new",
        "2026-10-31T03:00:00.000Z",
      ]),
    );
  });

  it("druck.pageID は同じ batch で入れた page を題で引く", () => {
    const row = sqlOf(documentCreateStatements(db, createInput)[1]);
    expect(row.sql).toContain("(SELECT id FROM page WHERE title = ?)");
    expect(row.params[0]).toBe("部屋の CO2");
  });

  it("copy は atproto-document", () => {
    expect(sqlOf(documentCreateStatements(db, createInput)[3]).params).toEqual([
      "https://w.jgs.me/o/",
      "部屋の CO2",
      "atproto-document",
      AT_URI,
      "bafy1",
    ]);
  });

  it("druck は publishedAt の JST 日付", () => {
    expect(
      sqlOf(documentCreateStatements(db, createInput)[1]).params,
    ).toContain("2026-10-31");
  });

  it("create の SQL に article が現れない", () => {
    for (const st of documentCreateStatements(db, createInput)) {
      expect(sqlOf(st).sql).not.toContain('"article"');
    }
  });

  it("object は source_protocol = atproto", () => {
    expect(
      sqlOf(documentCreateStatements(db, createInput)[2]).params,
    ).toContain("atproto");
  });
});

describe("documentUpdateStatements", () => {
  it("page / copy / object の順", () => {
    expect(
      documentUpdateStatements(db, updateInput)
        .map(sqlOf)
        .map((s) => s.sql.split(" set")[0]),
    ).toEqual(['update "page"', 'update "copy"', 'update "object"']);
  });

  it("update は題を書き換え、bodyKey は触らない", () => {
    const page = sqlOf(documentUpdateStatements(db, updateInput)[0]);
    expect(page.sql).toContain('"title" = ?');
    expect(page.sql).not.toContain('"bodyKey"');
    // page.bodyKey の実カラム名
    expect(page.sql).not.toContain('"sbID"');
    expect(page.params).toEqual(
      expect.arrayContaining(["改題", "https://a.example/1.png", 42]),
    );
  });

  it("update の copy は atproto-document の行の CID だけ", () => {
    expect(sqlOf(documentUpdateStatements(db, updateInput)[1]).params).toEqual([
      "bafy2",
      "https://w.jgs.me/o/42",
      "atproto-document",
    ]);
  });

  it("object は atproto / mf2 / updated を書き換える", () => {
    const object = sqlOf(documentUpdateStatements(db, updateInput)[2]);
    expect(object.params).toEqual([
      "{}",
      "{}",
      "2026-11-01T00:00:00.000Z",
      "https://w.jgs.me/o/42",
    ]);
  });
});
