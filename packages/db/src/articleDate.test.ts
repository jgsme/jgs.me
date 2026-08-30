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

  it("題と from 行の間に空行があっても拾う", () => {
    expect(extractBodyDate("題\n\nfrom [20240102]\n\n本文A")).toBe(
      "2024-01-02",
    );
  });

  it("題と from 行の間に空行が複数あっても拾う", () => {
    expect(extractBodyDate("題\n\n\n\nfrom [20240102]\n本文")).toBe(
      "2024-01-02",
    );
  });

  it("空白のみの行も空行として扱う", () => {
    expect(extractBodyDate("題\n  \nfrom [20240102]\n本文")).toBe(
      "2024-01-02",
    );
  });

  it("題(0行目)自体が from [...] 形式でも拾わない", () => {
    expect(extractBodyDate("from [20240102]\n本文\n本文2")).toBeNull();
  });

  it("末尾から 5 行目の #YYYYMMDD は拾う", () => {
    // 6 行なので index 1 がちょうど末尾 5 行目。境界の内側。
    const body = ["題", "#20240102", "a", "b", "c", "d"].join("\n");
    expect(extractBodyDate(body)).toBe("2024-01-02");
  });

  it("末尾から 6 行目の #YYYYMMDD は拾わない", () => {
    // 7 行にすると index 1 は末尾 6 行目になり、境界の外側に出る。
    const body = ["題", "#20240102", "a", "b", "c", "d", "e"].join("\n");
    expect(extractBodyDate(body)).toBeNull();
  });

  it("日付が無ければ null", () => {
    expect(extractBodyDate("題\n本文")).toBeNull();
  });

  it("月日として不正な値は拾わない", () => {
    expect(extractBodyDate("題\nfrom [20241332]\n本文")).toBeNull();
  });

  it("作成日と更新日が並記されていれば作成日を採る", () => {
    // #... C が作成日、#... U が更新日。下から探すと更新日を拾ってしまう。
    const body = ["題", "本文", "", "#20190527 #0527 C", "#20190605 #0605 U"].join("\n");
    expect(extractBodyDate(body)).toBe("2019-05-27");
  });

  it("マーカーが無くても古い方を採る", () => {
    // 旧ブログ移行記事は「元記事の日付」と「移行日」を並記する。
    const body = ["題", "本文", "", "#20081120", "#20191121"].join("\n");
    expect(extractBodyDate(body)).toBe("2008-11-20");
  });

  it("同じ行に複数あっても古い方を採る", () => {
    expect(extractBodyDate("題\n本文\n#20191121 #20081120")).toBe("2008-11-20");
  });

  it("同じ日付が繰り返されていてもその日付を返す", () => {
    const body = ["題", "本文", "#20190219", "#20190219", "#20190219"].join("\n");
    expect(extractBodyDate(body)).toBe("2019-02-19");
  });

  it("無効な日付は候補に入れず、有効なものから最古を選ぶ", () => {
    const body = ["題", "本文", "#20241332", "#20240102", "#20240301"].join("\n");
    expect(extractBodyDate(body)).toBe("2024-01-02");
  });
});

describe("extractBodyMonthDay", () => {
  it("本文の #MMDD を拾う", () => {
    expect(extractBodyMonthDay("題\n本文\n#0625")).toBe("06-25");
  });

  it("#YYYYMMDD の一部を #MMDD として誤検出しない", () => {
    expect(extractBodyMonthDay("題\n本文\n#20240625")).toBeNull();
  });

  it("先頭4桁が妥当な月日になる 8 桁タグも #MMDD として拾わない", () => {
    // #12312024 の先頭 4 桁は 12-31 で月日として妥当。前後の桁を見張っていないと
    // ここを拾ってしまう。isValidMonthDay では弾けないので guard だけが頼り。
    expect(extractBodyMonthDay("題\n本文\n#12312024")).toBeNull();
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
