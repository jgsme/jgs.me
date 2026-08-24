import { describe, expect, it } from "vitest";
import { jstDate } from "./jstDate";

describe("jstDate", () => {
  it("UTC の ISO8601 を JST の日付に直す", () => {
    expect(jstDate("2026-08-24T03:30:00.000Z")).toBe("2026/08/24");
  });

  it("UTC 深夜は JST では翌日になる", () => {
    expect(jstDate("2026-08-24T15:30:00.000Z")).toBe("2026/08/25");
  });

  it("月をまたぐ", () => {
    expect(jstDate("2026-08-31T15:00:00.000Z")).toBe("2026/09/01");
  });

  it("年をまたぐ", () => {
    expect(jstDate("2026-12-31T16:00:00.000Z")).toBe("2027/01/01");
  });

  it("日付として読めなければ null", () => {
    expect(jstDate("not a date")).toBeNull();
  });

  it("空文字は null", () => {
    expect(jstDate("")).toBeNull();
  });
});
