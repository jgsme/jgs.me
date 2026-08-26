import { describe, expect, it } from "vitest";
import {
  extractBodyDate,
  extractBodyMonthDay,
  jstDate,
  resolveArticleDate,
} from "./articleDate";

describe("extractBodyDate", () => {
  it("1行目の from [YYYYMMDD] を拾う", () => {
    expect(extractBodyDate("題\nfrom [20240102]\n本文")).toBe("2024-01-02");
  });

  it("from [YYYYMMDD] は #MMDD が同じ行にあっても拾える", () => {
    expect(extractBodyDate("題\nfrom [20220911] #0911\n本文")).toBe(
      "2022-09-11",
    );
  });

  it("末尾の #YYYYMMDD を拾う", () => {
    expect(extractBodyDate("題\n本文\n#20240102")).toBe("2024-01-02");
  });

  it("末尾から 5 行より前の #YYYYMMDD は拾わない", () => {
    const body = ["題", "#20240102", "a", "b", "c", "d", "e", "f"].join("\n");
    expect(extractBodyDate(body)).toBeNull();
  });

  it("日付が無ければ null", () => {
    expect(extractBodyDate("題\n本文")).toBeNull();
  });

  it("月日として不正な値は拾わない", () => {
    expect(extractBodyDate("題\nfrom [20241332]\n本文")).toBeNull();
  });
});

describe("extractBodyMonthDay", () => {
  it("本文の #MMDD を拾う", () => {
    expect(extractBodyMonthDay("題\n本文\n#0625")).toBe("06-25");
  });

  it("#YYYYMMDD の一部を #MMDD として誤検出しない", () => {
    expect(extractBodyMonthDay("題\n本文\n#20240625")).toBeNull();
  });

  it("月日として不正な値は拾わない", () => {
    expect(extractBodyMonthDay("題\n本文\n#1350")).toBeNull();
    expect(extractBodyMonthDay("題\n本文\n#0000")).toBeNull();
  });

  it("最初の #MMDD を返す", () => {
    expect(extractBodyMonthDay("題\n#0625\n#0808")).toBe("06-25");
  });

  it("無ければ null", () => {
    expect(extractBodyMonthDay("題\n本文")).toBeNull();
  });
});

describe("jstDate", () => {
  it("UTC の ISO8601 を JST の暦日に直す", () => {
    expect(jstDate("2026-08-24T15:30:00.000Z")).toBe("2026-08-25");
  });

  it("日付をまたがない時刻はそのまま", () => {
    expect(jstDate("2026-08-24T03:30:00.000Z")).toBe("2026-08-24");
  });

  it("月末をまたぐ", () => {
    expect(jstDate("2026-08-31T15:00:00.000Z")).toBe("2026-09-01");
  });

  it("年をまたぐ", () => {
    expect(jstDate("2026-12-31T16:00:00.000Z")).toBe("2027-01-01");
  });

  it("日付として読めない文字列は null", () => {
    expect(jstDate("not a date")).toBeNull();
  });

  it("空文字は null", () => {
    expect(jstDate("")).toBeNull();
  });
});

describe("resolveArticleDate", () => {
  const base = {
    body: null,
    title: "今日のごはん",
    bodyKey: "5f8a1b2c3d4e5f6a7b8c9d0e",
    created: "2026-08-24T03:30:00.000Z",
  };

  it("規則1: 本文の from [YYYYMMDD] を最優先する", () => {
    expect(
      resolveArticleDate({
        ...base,
        body: "題\nfrom [20200102]\n本文",
        title: "20240506",
      }),
    ).toBe("2020-01-02");
  });

  it("規則2: 末尾の #YYYYMMDD を使う", () => {
    expect(
      resolveArticleDate({ ...base, body: "題\n本文\n#20200102" }),
    ).toBe("2020-01-02");
  });

  it("規則3: 本文に無ければタイトルの YYYYMMDD を使う", () => {
    expect(resolveArticleDate({ ...base, title: "20240506" })).toBe(
      "2024-05-06",
    );
  });

  it("規則4: 本文の #MMDD と created の年を組み合わせる", () => {
    expect(
      resolveArticleDate({
        ...base,
        body: "題\n本文\n#0625",
        created: "2012-06-25T12:00:00.000Z",
      }),
    ).toBe("2012-06-25");
  });

  it("規則4: created の日付がズレていても月日は本文を使う", () => {
    expect(
      resolveArticleDate({
        ...base,
        body: "題\n本文\n#1130",
        created: "2008-12-01T02:00:00.000Z",
      }),
    ).toBe("2008-11-30");
  });

  it("規則4 は規則2 より弱い", () => {
    expect(
      resolveArticleDate({
        ...base,
        body: "題\n本文\n#0625\n#20240102",
      }),
    ).toBe("2024-01-02");
  });

  it("規則5: micropub 由来なら created を JST で使う", () => {
    expect(
      resolveArticleDate({
        ...base,
        bodyKey: "sb-abc",
        created: "2026-08-24T15:30:00.000Z",
      }),
    ).toBe("2026-08-25");
  });

  it("規則5: Scrapbox 由来は created を使わない", () => {
    expect(resolveArticleDate(base)).toBeNull();
  });

  it("規則6: どれにも当たらなければ null", () => {
    expect(resolveArticleDate({ ...base, bodyKey: "sb-abc", created: "" })).toBeNull();
  });

  it("body が null でもタイトルから決まる", () => {
    expect(resolveArticleDate({ ...base, body: null, title: "20240506" })).toBe(
      "2024-05-06",
    );
  });
});
