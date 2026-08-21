import { describe, expect, it } from "vitest";
import { MAX_AGE_DAYS, decideFanout } from "./fanout";

const NOW = new Date("2026-08-17T00:00:00.000Z");

describe("decideFanout", () => {
  it("今日の記事は配信する", () => {
    expect(decideFanout("2026-08-17T00:00:00.000Z", NOW)).toEqual({
      deliver: true,
    });
  });

  it("13 日前なら配信する", () => {
    expect(decideFanout("2026-08-04T00:00:00.000Z", NOW)).toEqual({
      deliver: true,
    });
  });

  it("14 日ちょうどは配信する (境界を含む)", () => {
    expect(decideFanout("2026-08-03T00:00:00.000Z", NOW)).toEqual({
      deliver: true,
    });
  });

  it("15 日前は配信しない", () => {
    expect(decideFanout("2026-08-02T00:00:00.000Z", NOW)).toEqual({
      deliver: false,
      reason: "too-old",
    });
  });

  it("数年前のアーカイブ記事は配信しない", () => {
    expect(decideFanout("2022-01-01T00:00:00.000Z", NOW)).toEqual({
      deliver: false,
      reason: "too-old",
    });
  });

  it("未来日付は配信する (時計ずれを弾かない)", () => {
    expect(decideFanout("2026-09-01T00:00:00.000Z", NOW)).toEqual({
      deliver: true,
    });
  });

  it("閾値を変えられる", () => {
    expect(decideFanout("2026-08-10T00:00:00.000Z", NOW, 3)).toEqual({
      deliver: false,
      reason: "too-old",
    });
  });

  it("日付として読めない値は配信しない", () => {
    expect(decideFanout("not-a-date", NOW)).toEqual({
      deliver: false,
      reason: "too-old",
    });
  });

  it("既定の閾値は 14 日", () => {
    expect(MAX_AGE_DAYS).toBe(14);
  });

  it("D1 の CURRENT_TIMESTAMP 形式も UTC として読む", () => {
    expect(decideFanout("2026-08-16 23:00:00", NOW)).toEqual({ deliver: true });
    expect(decideFanout("2020-04-02 09:34:00", NOW)).toEqual({
      deliver: false,
      reason: "too-old",
    });
  });
});
