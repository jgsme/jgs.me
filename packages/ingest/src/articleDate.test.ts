import { describe, expect, it } from "vitest";
import { jstDate } from "@jigsaw/db/article-date";

// micropub の article insert は date に jstDate(created) を入れる。
// created は投稿時刻そのものなので、本文を読まずに暦日が決まる。
// 周年日記 (/on-this-day/MMDD) はこの値で記事を引くため、JST の境界がずれると
// 記事が 1 日隣に並ぶ。
describe("micropub が article.date に入れる値", () => {
  it("JST の暦日を YYYY-MM-DD で返す", () => {
    expect(jstDate("2026-08-27T03:30:00.000Z")).toBe("2026-08-27");
  });

  it("UTC 深夜は JST では翌日になる", () => {
    expect(jstDate("2026-08-27T15:30:00.000Z")).toBe("2026-08-28");
  });

  it("月をまたぐ", () => {
    expect(jstDate("2026-08-31T15:00:00.000Z")).toBe("2026-09-01");
  });

  it("年をまたぐ", () => {
    expect(jstDate("2026-12-31T16:00:00.000Z")).toBe("2027-01-01");
  });

  it("読めない値は null (date は NULL のままになる)", () => {
    expect(jstDate("")).toBeNull();
  });
});
