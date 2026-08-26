import { describe, expect, it } from "vitest";
import { dateFromEntry } from "./index";

describe("dateFromEntry", () => {
  it("MMDD と年から ISO 日付を組み立てる", () => {
    expect(dateFromEntry("0401", 2022)).toBe("2022-04-01");
  });

  it("うるう日も通す", () => {
    expect(dateFromEntry("0229", 2024)).toBe("2024-02-29");
  });

  it("4 桁でなければ null", () => {
    expect(dateFromEntry("401", 2022)).toBeNull();
  });

  it("月日として不正なら null", () => {
    expect(dateFromEntry("1350", 2022)).toBeNull();
    expect(dateFromEntry("0000", 2022)).toBeNull();
  });
});
