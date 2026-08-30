import { describe, expect, it } from "vitest";
import {
  adjacentDays,
  isMonthDay,
  monthDayLabel,
  toMonthDay,
} from "./monthDay";

describe("isMonthDay", () => {
  it("暦にある月日を通す", () => {
    expect(isMonthDay("0101")).toBe(true);
    expect(isMonthDay("0229")).toBe(true);
    expect(isMonthDay("1231")).toBe(true);
  });

  it("暦に無い月日を弾く", () => {
    expect(isMonthDay("0431")).toBe(false);
    expect(isMonthDay("0230")).toBe(false);
    expect(isMonthDay("1301")).toBe(false);
    expect(isMonthDay("0100")).toBe(false);
  });

  it("4桁でないものを弾く", () => {
    expect(isMonthDay("401")).toBe(false);
    expect(isMonthDay("04-01")).toBe(false);
    expect(isMonthDay("")).toBe(false);
  });
});

describe("toMonthDay", () => {
  it("article.date の後半と同じ形にする", () => {
    expect(toMonthDay("0401")).toBe("04-01");
    expect(toMonthDay("1231")).toBe("12-31");
  });

  it("暦に無ければ null", () => {
    expect(toMonthDay("0431")).toBeNull();
  });
});

describe("monthDayLabel", () => {
  it("ゼロ埋めを外す", () => {
    expect(monthDayLabel("0401")).toBe("4月1日");
    expect(monthDayLabel("1231")).toBe("12月31日");
  });
});

describe("adjacentDays", () => {
  it("月の途中は前後の日", () => {
    expect(adjacentDays("0401")).toEqual({ prev: "0331", next: "0402" });
  });

  it("月末は月をまたぐ", () => {
    expect(adjacentDays("0430")).toEqual({ prev: "0429", next: "0501" });
  });

  it("2/29 を飛ばさない", () => {
    expect(adjacentDays("0228")).toEqual({ prev: "0227", next: "0229" });
    expect(adjacentDays("0229")).toEqual({ prev: "0228", next: "0301" });
    expect(adjacentDays("0301")).toEqual({ prev: "0229", next: "0302" });
  });

  it("年末年始は輪でつながる", () => {
    expect(adjacentDays("1231")).toEqual({ prev: "1230", next: "0101" });
    expect(adjacentDays("0101")).toEqual({ prev: "1231", next: "0102" });
  });

  it("暦に無ければ null", () => {
    expect(adjacentDays("0431")).toBeNull();
  });
});
