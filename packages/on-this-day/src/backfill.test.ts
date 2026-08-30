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

  it("複数の日付に貼られている記事は map に入れず本文解決に委ねる", () => {
    // 改元は 05-01 が本文の日付だが、手書きでは前日 04-30 にも貼られている。
    // 手書きだけでは決められないので本文に委ねる。
    const map = buildFallbackMap([
      { targetPageID: 1029, year: 2019, mmdd: "0501" },
      { targetPageID: 1029, year: 2019, mmdd: "0430" },
    ]);
    expect(map[1029]).toBeUndefined();
  });

  it("同一日付への重複は曖昧ではないので採る", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2022, mmdd: "0401" },
      { targetPageID: 1, year: 2022, mmdd: "0401" },
    ]);
    expect(map[1]).toBe("2022-04-01");
  });

  it("mmdd が不正な行はスキップし、有効な兄弟行は残す", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2022, mmdd: "9999" },
      { targetPageID: 1, year: 2019, mmdd: "0527" },
    ]);
    expect(map[1]).toBe("2019-05-27");
  });

  it("三件中二件が同じ日付、一件だけ違う場合は map に入れない", () => {
    const map = buildFallbackMap([
      { targetPageID: 1, year: 2019, mmdd: "0501" },
      { targetPageID: 1, year: 2019, mmdd: "0501" },
      { targetPageID: 1, year: 2019, mmdd: "0430" },
    ]);
    expect(map[1]).toBeUndefined();
  });
});
