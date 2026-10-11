import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { zetCreateStatements, zetUpdateStatements } from "./zetStore";
import type { ZetCreateInput, ZetUpdateInput } from "./zet";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`;

// toSQL() は D1 を叩かない。文の形と束縛値だけを固定する。
const db = drizzle({} as D1Database);
const sqlOf = (s: unknown) =>
  (s as { toSQL(): { sql: string; params: unknown[] } }).toSQL();

const createInput = (links: string[] = []): ZetCreateInput => ({
  pageTitle: `zet:${RKEY}`,
  rkey: RKEY,
  bodyKey: "sb-new",
  created: "2026-10-11T01:00:00.000Z",
  image: null,
  date: "2026-10-11",
  zetTitle: null,
  atUri: AT_URI,
  cid: "bafycid1",
  atproto: "{}",
  mf2: "{}",
  links,
});

const updateInput = (links: string[] = []): ZetUpdateInput => ({
  pageID: 7,
  updated: "2026-10-11T02:00:00.000Z",
  image: "https://example.com/a.png",
  date: "2026-10-10",
  zetTitle: "改題",
  cid: "bafycid2",
  atproto: "{}",
  mf2: "{}",
  links,
});

describe("zetCreateStatements", () => {
  it("page / zet / object / copy の順に 1 batch で入れる", () => {
    const sqls = zetCreateStatements(db, createInput()).map(sqlOf);
    expect(sqls).toHaveLength(4);
    expect(sqls[0]!.sql).toMatch(/^insert into "page"/);
    expect(sqls[1]!.sql).toMatch(/^insert into "zet"/);
    expect(sqls[2]!.sql).toMatch(/^insert into "object"/);
    expect(sqls[3]!.sql).toMatch(/^insert into "copy"/);
  });

  it("zet.pageID は同じ batch で入れた page を題で引く", () => {
    const zet = sqlOf(zetCreateStatements(db, createInput())[1]);
    expect(zet.sql).toBe(
      'insert into "zet" ("id", "pageID", "rkey", "date", "title", "created") values (null, (SELECT id FROM page WHERE title = ?), ?, ?, ?, ?)',
    );
    expect(zet.params).toEqual([
      `zet:${RKEY}`,
      RKEY,
      "2026-10-11",
      null,
      "2026-10-11T01:00:00.000Z",
    ]);
  });

  it("copy は object.id と atproto-zet で at-uri と CID を持つ", () => {
    const copy = sqlOf(zetCreateStatements(db, createInput())[3]);
    expect(copy.sql).toBe(
      'insert into "copy" ("objectID", "protocol", "uri", "cid") values (? || (SELECT id FROM page WHERE title = ?), ?, ?, ?)',
    );
    expect(copy.params).toEqual([
      "https://w.jgs.me/o/",
      `zet:${RKEY}`,
      "atproto-zet",
      AT_URI,
      "bafycid1",
    ]);
  });

  it("object は source_protocol = atproto で原本を持つ", () => {
    const object = sqlOf(zetCreateStatements(db, createInput())[2]);
    expect(object.params).toContain("atproto");
    expect(object.params).toContain("https://w.jgs.me/o/");
  });

  it("被リンクは 16 件ずつの文に刻む", () => {
    const links = Array.from({ length: 17 }, (_, i) => `題${i}`);
    expect(zetCreateStatements(db, createInput(links))).toHaveLength(6);
  });
});

describe("zetUpdateStatements", () => {
  it("page / zet / copy / object を更新し、被リンクを入れ直す", () => {
    const sqls = zetUpdateStatements(db, updateInput(["公園"])).map(sqlOf);
    expect(sqls.map((s) => s.sql.split(" ").slice(0, 2).join(" "))).toEqual([
      'update "page"',
      'update "zet"',
      'update "copy"',
      'update "object"',
      "delete from",
      "insert into",
    ]);
  });

  it("copy は atproto-zet の行の CID だけを書き換える", () => {
    const copy = sqlOf(zetUpdateStatements(db, updateInput())[2]);
    expect(copy.sql).toBe(
      'update "copy" set "cid" = ? where ("copy"."objectID" = ? and "copy"."protocol" = ?)',
    );
    expect(copy.params).toEqual([
      "bafycid2",
      "https://w.jgs.me/o/7",
      "atproto-zet",
    ]);
  });

  it("zet の題と日付を書き換える", () => {
    const zet = sqlOf(zetUpdateStatements(db, updateInput())[1]);
    expect(zet.params).toEqual(["2026-10-10", "改題", 7]);
  });
});
