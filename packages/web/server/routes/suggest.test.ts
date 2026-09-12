import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { escapeLikePattern, suggest, suggestTitles } from "./suggest";
import type { Bindings } from "../types";
import type { SuggestDB } from "./suggest";

describe("escapeLikePattern", () => {
  it("普通の文字はそのまま通す", () => {
    expect(escapeLikePattern("猫")).toBe("猫");
  });

  // "100%" で検索したとき、% が任意文字列として効くと "1000円" まで拾う。
  it("% をエスケープする", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("_ をエスケープする", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  // エスケープ文字自身を先に潰さないと "\%" が "\" + ワイルドカードになる。
  it("バックスラッシュ自身をエスケープする", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("バックスラッシュと % が並んでもワイルドカードにしない", () => {
    expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
  });
});

describe("suggestTitles", () => {
  const setup = (rows: { title: string; excluded?: boolean }[]): SuggestDB => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(
      `CREATE TABLE page (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        created TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        updated TEXT NOT NULL,
        image TEXT,
        sbID TEXT NOT NULL
      );
      CREATE TABLE excluded_page (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        pageID INTEGER NOT NULL,
        created TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );`,
    );
    const insertPage = sqlite.prepare(
      `INSERT INTO page (title, updated, sbID) VALUES (?, '', '')`,
    );
    const insertExcluded = sqlite.prepare(
      `INSERT INTO excluded_page (pageID) VALUES (?)`,
    );
    for (const row of rows) {
      const { lastInsertRowid } = insertPage.run(row.title);
      if (row.excluded) insertExcluded.run(lastInsertRowid);
    }

    return drizzle(async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const all = stmt.all(...(params as never[])).map((r) => Object.values(r));
      return { rows: method === "get" ? all[0] : all };
    }) as unknown as SuggestDB;
  };

  it("部分一致で引ける", async () => {
    const db = setup([{ title: "猫と暮らす" }, { title: "犬と暮らす" }]);
    expect(await suggestTitles(db, "猫")).toEqual(["猫と暮らす"]);
  });

  // excluded_page は「見せない」意図の枠。記事ページのカードにも出していない。
  it("excluded_page のページは出さない", async () => {
    const db = setup([
      { title: "猫と暮らす", excluded: true },
      { title: "猫の写真" },
    ]);
    expect(await suggestTitles(db, "猫")).toEqual(["猫の写真"]);
  });

  it("前方一致を部分一致より上に出す", async () => {
    const db = setup([{ title: "うちの猫" }, { title: "猫" }]);
    expect(await suggestTitles(db, "猫")).toEqual(["猫", "うちの猫"]);
  });

  // 同じ前方一致どうしなら、短い題のほうが概念そのものに近い。
  it("同着は短い題を上に出す", async () => {
    const db = setup([{ title: "猫の写真を撮る" }, { title: "猫の話" }]);
    expect(await suggestTitles(db, "猫")).toEqual(["猫の話", "猫の写真を撮る"]);
  });

  it("% をワイルドカードとして扱わない", async () => {
    const db = setup([{ title: "100%果汁" }, { title: "1000円" }]);
    expect(await suggestTitles(db, "100%")).toEqual(["100%果汁"]);
  });

  it("_ をワイルドカードとして扱わない", async () => {
    const db = setup([{ title: "a_b" }, { title: "axb" }]);
    expect(await suggestTitles(db, "a_b")).toEqual(["a_b"]);
  });

  it("limit で件数を切る", async () => {
    const db = setup([{ title: "猫1" }, { title: "猫2" }, { title: "猫3" }]);
    expect(await suggestTitles(db, "猫", 2)).toHaveLength(2);
  });

  // 空文字を素通しすると LIKE '%%' が全件に当たる。
  it("空文字は DB を引かずに空を返す", async () => {
    const db = setup([{ title: "猫" }]);
    expect(await suggestTitles(db, "")).toEqual([]);
  });

  it("空白だけのクエリも空を返す", async () => {
    const db = setup([{ title: "猫" }]);
    expect(await suggestTitles(db, "   ")).toEqual([]);
  });
});

describe("GET /api/search/suggest", () => {
  // q が無いときは DB を引かないので、D1 を用意せずに応答の形を確かめられる。
  const env = { DB: undefined } as unknown as Bindings;

  it("JSON で titles を返す", async () => {
    const res = await suggest.request("/api/search/suggest", {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({ titles: [] });
  });

  it("q が無ければ空を返す", async () => {
    const res = await suggest.request("/api/search/suggest", {}, env);

    expect(await res.json()).toEqual({ titles: [] });
  });
});
