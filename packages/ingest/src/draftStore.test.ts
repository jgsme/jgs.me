import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { draftPublishStatements } from "./draftStore";
import type { DraftPublishInput } from "./draft";

// toSQL() は D1 を叩かない。文の形と束縛値だけを固定する。
const db = drizzle({} as D1Database);
const sqlOf = (s: unknown) =>
  (s as { toSQL(): { sql: string; params: unknown[] } }).toSQL();

const input = (body = "題\n本文"): DraftPublishInput => ({
  draftID: 42,
  title: "題",
  bodyKey: "sb-new",
  body,
  image: null,
  spoiler: false,
  mf2: "{}",
  created: "2026-11-10T15:30:00.000Z",
  date: "2026-11-11",
});

describe("draftPublishStatements", () => {
  it("公開の batch は page → article → object → page_link → draft の削除 の順", () => {
    const sqls = draftPublishStatements(db, input()).map((s) => sqlOf(s).sql);
    expect(sqls[0]).toContain('insert into "page"');
    expect(sqls[1]).toContain('insert into "article"');
    expect(sqls[2]).toContain('insert into "object"');
    expect(sqls.at(-1)).toContain('delete from "draft"');
  });

  it("本文のリンクを page_link に入れる (16 行ずつ)", () => {
    const body = ["題", ...Array.from({ length: 17 }, (_, i) => `[l${i}]`)].join(
      "\n",
    );
    const sqls = draftPublishStatements(db, input(body)).map((s) => sqlOf(s));
    const links = sqls.filter((s) => s.sql.includes('insert into "page_link"'));
    expect(links).toHaveLength(2);
    expect(links[0]!.sql.match(/\(\(SELECT/g)).toHaveLength(16);
    expect(links[1]!.sql.match(/\(\(SELECT/g)).toHaveLength(1);
  });

  it("リンクが無ければ page_link の文は無い", () => {
    const sqls = draftPublishStatements(db, input()).map((s) => sqlOf(s).sql);
    expect(sqls).toHaveLength(4);
    expect(sqls.some((s) => s.includes('"page_link"'))).toBe(false);
  });

  it("draft の削除は draftID で絞る", () => {
    const last = sqlOf(draftPublishStatements(db, input()).at(-1));
    expect(last.sql).toContain('where "draft"."id" = ?');
    expect(last.params).toEqual([42]);
  });

  it("page と article の created は input.created、date は input.date", () => {
    const [page, article] = draftPublishStatements(db, input()).map(sqlOf);
    expect(page!.params).toContain("2026-11-10T15:30:00.000Z");
    expect(article!.params).toEqual([
      "題",
      "2026-11-10T15:30:00.000Z",
      "2026-11-11",
    ]);
  });
});
