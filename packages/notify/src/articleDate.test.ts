import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { articles, pages } from "@jigsaw/db";
import { resolveAndStoreDate } from "./actions";

type PageRow = { bodyKey: string; title: string; created: string };

// drizzle の select().from().where().limit() チェーンと
// update().set().where() チェーンだけを満たすスタブ。
// where() に渡された条件も記録する。捨ててしまうと「どの行に書いたか」が
// 一切検証されず、article.pageID と article.id の取り違えを見逃す。
function stubDb(page: PageRow | undefined) {
  const updates: { date: string | null }[] = [];
  const wheres: { kind: "select" | "update"; cond: unknown }[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          wheres.push({ kind: "select", cond });
          return { limit: async () => (page ? [page] : []) };
        },
      }),
    }),
    update: () => ({
      set: (values: { date: string | null }) => {
        updates.push(values);
        return {
          where: async (cond: unknown) => {
            wheres.push({ kind: "update", cond });
          },
        };
      },
    }),
  };
  return { db, updates, wheres };
}

function stubR2(text: string | null) {
  return {
    get: async () =>
      text === null
        ? null
        : {
            text: async () => text,
            json: async () => ({
              lines: text.split("\n").map((t) => ({ text: t })),
            }),
          },
  };
}

describe("resolveAndStoreDate", () => {
  it("本文の from [YYYYMMDD] から日付を決めて書く", async () => {
    const { db, updates } = stubDb({
      bodyKey: "abc123",
      title: "F1 2022 イタリアGP",
      created: "2022-09-12T00:00:00.000Z",
    });
    const r2 = stubR2("F1 2022 イタリアGP\nfrom [20220911] #0911\n本文");

    const got = await resolveAndStoreDate(db as never, r2 as never, 1);

    expect(got).toBe("2022-09-11");
    expect(updates).toEqual([{ date: "2022-09-11" }]);
  });

  it("旧ブログ移行記事は #MMDD と created の年から決める", async () => {
    const { db, updates } = stubDb({
      bodyKey: "abc123",
      title: "正月映画 - e-jigsaw.blogspot.com",
      created: "2009-01-04T05:00:00.000Z",
    });
    const r2 = stubR2("正月映画 - e-jigsaw.blogspot.com\n本文\n#0104");

    const got = await resolveAndStoreDate(db as never, r2 as never, 1);

    expect(got).toBe("2009-01-04");
    expect(updates).toEqual([{ date: "2009-01-04" }]);
  });

  it("日付が決まらなければ書かない", async () => {
    const { db, updates } = stubDb({
      bodyKey: "abc123",
      title: "2023 ベスト・映画",
      created: "2024-01-05T00:00:00.000Z",
    });
    const r2 = stubR2("2023 ベスト・映画\n本文");

    const got = await resolveAndStoreDate(db as never, r2 as never, 1);

    expect(got).toBeNull();
    expect(updates).toEqual([]);
  });

  it("page が無ければ何もしない", async () => {
    const { db, updates } = stubDb(undefined);
    const r2 = stubR2(null);

    const got = await resolveAndStoreDate(db as never, r2 as never, 999);

    expect(got).toBeNull();
    expect(updates).toEqual([]);
  });

  it("R2 が空でもタイトルから決まれば書く", async () => {
    const { db, updates } = stubDb({
      bodyKey: "abc123",
      title: "20240506",
      created: "2024-05-06T00:00:00.000Z",
    });
    const r2 = stubR2(null);

    const got = await resolveAndStoreDate(db as never, r2 as never, 1);

    expect(got).toBe("2024-05-06");
    expect(updates).toEqual([{ date: "2024-05-06" }]);
  });

  it("渡された pageId のページを引く", async () => {
    const { db, wheres } = stubDb({
      bodyKey: "abc123",
      title: "題",
      created: "2024-01-02T00:00:00.000Z",
    });
    const r2 = stubR2("題\nfrom [20240102]\n本文");

    await resolveAndStoreDate(db as never, r2 as never, 42);

    expect(wheres.find((w) => w.kind === "select")?.cond).toEqual(
      eq(pages.id, 42),
    );
  });

  it("同じ pageId の article に書く", async () => {
    // articles には pageID と id が両方あるので、取り違えるとよその記事の
    // 日付を書き換えてしまう。書き込み対象の条件そのものを固定する。
    const { db, wheres } = stubDb({
      bodyKey: "abc123",
      title: "題",
      created: "2024-01-02T00:00:00.000Z",
    });
    const r2 = stubR2("題\nfrom [20240102]\n本文");

    await resolveAndStoreDate(db as never, r2 as never, 42);

    expect(wheres.find((w) => w.kind === "update")?.cond).toEqual(
      eq(articles.pageID, 42),
    );
  });
});
