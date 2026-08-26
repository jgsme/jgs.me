import { describe, expect, it, vi } from "vitest";
import { random } from "./random";

// drizzle の d1 driver は fields 指定の select で stmt.bind().raw() を叩き、
// 行を「列の配列」の配列で受け取る (drizzle-orm/d1 の PreparedQuery.values)。
// 必要な口だけ生やす。
const dbOf = (rows: unknown[][]) => {
  const prepare = vi.fn((_sql: string) => ({
    bind: (..._params: unknown[]) => ({
      raw: async () => rows,
    }),
  }));
  return { prepare } as unknown as D1Database & { prepare: typeof prepare };
};

const request = (db: D1Database) => random.request("/random", {}, { DB: db });

describe("GET /random", () => {
  it("引いた記事のページへ 302 で飛ばす", async () => {
    const res = await request(dbOf([["ランダムに引いた記事"]]));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/pages/${encodeURIComponent("ランダムに引いた記事")}`,
    );
  });

  // "a/b" のようなタイトルをそのまま置くと別のルートに化ける。
  it("タイトルを URL エンコードする", async () => {
    const res = await request(dbOf([["a/b?c"]]));

    expect(res.headers.get("Location")).toBe("/pages/a%2Fb%3Fc");
  });

  it("記事が 1 件も無ければトップへ 302", async () => {
    const res = await request(dbOf([]));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  // エッジや中間 CDN に焼かれると、以降ずっと同じ記事が返る。
  it("キャッシュさせない", async () => {
    const res = await request(dbOf([["題"]]));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // 全件を JS 側に持ってきて選ぶと記事が増えるほど重くなる。
  // 選ぶのは SQL 側、返すのは 1 行だけ。
  it("SQL 側で 1 行だけランダムに引く", async () => {
    const db = dbOf([["題"]]);
    await request(db);

    const sql = db.prepare.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("random()");
    expect(sql).toContain("limit");
  });
});
