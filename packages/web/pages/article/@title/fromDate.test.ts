import { describe, expect, it } from "vitest";
import { resolveFromDate } from "./fromDate";

describe("resolveFromDate", () => {
  it("本文から取れた日付を最優先する", () => {
    expect(
      resolveFromDate({
        bodyDate: "2020/01/02",
        title: "20240506",
        bodyKey: "sb-abc",
        created: "2026-08-24T03:30:00.000Z",
      }),
    ).toBe("2020/01/02");
  });

  it("本文に無ければタイトルの YYYYMMDD を使う", () => {
    expect(
      resolveFromDate({
        bodyDate: null,
        title: "20240506",
        bodyKey: "sb-abc",
        created: "2026-08-24T03:30:00.000Z",
      }),
    ).toBe("2024/05/06");
  });

  it("micropub 由来で日付が取れなければ created を JST で使う", () => {
    expect(
      resolveFromDate({
        bodyDate: null,
        title: "今日のごはん",
        bodyKey: "sb-abc",
        created: "2026-08-24T15:30:00.000Z",
      }),
    ).toBe("2026/08/25");
  });

  it("Scrapbox 由来は created を使わない", () => {
    expect(
      resolveFromDate({
        bodyDate: null,
        title: "今日のごはん",
        bodyKey: "5f8a1b2c3d4e5f6a7b8c9d0e",
        created: "2026-08-24T15:30:00.000Z",
      }),
    ).toBeNull();
  });

  it("micropub 由来でも created が読めなければ null", () => {
    expect(
      resolveFromDate({
        bodyDate: null,
        title: "今日のごはん",
        bodyKey: "sb-abc",
        created: "",
      }),
    ).toBeNull();
  });
});
