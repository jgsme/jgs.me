import { describe, expect, it, vi } from "vitest";
import { redirects } from "./redirects";

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

const request = (path: string, db: D1Database) =>
  redirects.request(path, {}, { DB: db });

describe("GET /c/:id", () => {
  it("clip のページへ 302 で飛ばす", async () => {
    const res = await request("/c/12", dbOf([["クリップした記事"]]));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/pages/${encodeURIComponent("クリップした記事")}`,
    );
  });

  // "a/b" のようなタイトルをそのまま置くと別のルートに化ける。
  it("タイトルを URL エンコードする", async () => {
    const res = await request("/c/12", dbOf([["a/b?c"]]));

    expect(res.headers.get("Location")).toBe("/pages/a%2Fb%3Fc");
  });

  it("その id の clip が無ければトップへ 302", async () => {
    const res = await request("/c/999", dbOf([]));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("数値でない id はトップへ 302", async () => {
    const res = await request("/c/abc", dbOf([["題"]]));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });
});
