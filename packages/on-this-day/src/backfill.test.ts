import { describe, expect, it } from "vitest";
import { buildFallbackMap, dateFromEntry } from "./index";

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

describe("buildFallbackMap", () => {
  it("単一の entry ならそのまま採る", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2022, mmdd: "0401" },
    ]);
    expect(map[1]).toBe("2022-04-01");
  });

  it("複数 entry では最古が後ろにあっても最古を採る (先勝ちではない)", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2022, mmdd: "0401" },
      { targetPageID: 1, year: 2019, mmdd: "0527" },
    ]);
    expect(map[1]).toBe("2019-05-27");
  });

  it("複数 entry で最古が先にあっても最古を採る", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2013, mmdd: "1117" },
      { targetPageID: 1, year: 2019, mmdd: "0605" },
    ]);
    expect(map[1]).toBe("2013-11-17");
  });

  it("mmdd が不正な行はスキップし、有効な兄弟行は残す", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2022, mmdd: "9999" },
      { targetPageID: 1, year: 2019, mmdd: "0527" },
    ]);
    expect(map[1]).toBe("2019-05-27");
  });

  it("六つの実例が最古勝ちで正しい日付になる", () => {
    const map = buildFallbackMap([
      // 改元: 2019-05-01 が正
      { targetPageID: 101, year: 2019, mmdd: "0501" },
      { targetPageID: 101, year: 2020, mmdd: "0501" },
      // 置き薬: 2013-11-17 が正
      { targetPageID: 102, year: 2013, mmdd: "1117" },
      { targetPageID: 102, year: 2015, mmdd: "1117" },
      // Twitter との付き合い方を変えた: 2019-05-27 が正
      { targetPageID: 103, year: 2019, mmdd: "0527" },
      { targetPageID: 103, year: 2020, mmdd: "0527" },
      // us 感想: 2019-09-06 が正
      { targetPageID: 104, year: 2019, mmdd: "0906" },
      { targetPageID: 104, year: 2020, mmdd: "0906" },
      // JOKER 感想: 2019-10-04 が正
      { targetPageID: 105, year: 2019, mmdd: "1004" },
      { targetPageID: 105, year: 2020, mmdd: "1004" },
      // 一緒に働く人に求めること: 2019-10-30 が正
      { targetPageID: 106, year: 2019, mmdd: "1030" },
      { targetPageID: 106, year: 2020, mmdd: "1030" },
    ]);
    expect(map[101]).toBe("2019-05-01");
    expect(map[102]).toBe("2013-11-17");
    expect(map[103]).toBe("2019-05-27");
    expect(map[104]).toBe("2019-09-06");
    expect(map[105]).toBe("2019-10-04");
    expect(map[106]).toBe("2019-10-30");
  });
});
