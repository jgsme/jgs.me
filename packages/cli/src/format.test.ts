import { describe, expect, it } from "vitest";
import { formatResult } from "./format.ts";

function output(
  pages: { id: number; title: string }[],
  article: number[],
  clip: number[],
  excluded: number[],
) {
  const rows = (ids: number[]) => ids.map((pageID) => ({ pageID }));
  return [
    { results: pages, success: true },
    { results: rows(article), success: true },
    { results: rows(clip), success: true },
    { results: rows(excluded), success: true },
    { results: [], success: true },
    { results: [], success: true },
    { results: [], success: true },
  ];
}

describe("formatResult", () => {
  it("削除したテーブルを列挙する", () => {
    const text = formatResult(
      [1613],
      output([{ id: 1613, title: "例のページ" }], [1613], [], []),
    );
    expect(text).toBe("1613 「例のページ」: article を削除");
  });

  it("複数テーブルに入っていたら全部並べる", () => {
    const text = formatResult(
      [1612],
      output([{ id: 1612, title: "別のページ" }], [], [1612], [1612]),
    );
    expect(text).toBe("1612 「別のページ」: clip, excluded_page を削除");
  });

  it("どこにも入っていなければ「もともと未登録」と出す", () => {
    const text = formatResult(
      [1611],
      output([{ id: 1611, title: "未登録のページ" }], [], [], []),
    );
    expect(text).toBe("1611 「未登録のページ」: もともと未登録");
  });

  it("page が存在しなければその旨を出す", () => {
    const text = formatResult([1610], output([], [], [], []));
    expect(text).toBe("1610: page が存在しない");
  });

  it("複数 ID を引数の順で 1 行ずつ出す", () => {
    const text = formatResult(
      [1613, 1610],
      output([{ id: 1613, title: "例のページ" }], [1613], [], []),
    );
    expect(text).toBe(
      "1613 「例のページ」: article を削除\n1610: page が存在しない",
    );
  });

  it("ラッパーオブジェクトに包まれていても剥がして読む", () => {
    const wrapped = {
      result: output([{ id: 1613, title: "例のページ" }], [1613], [], []),
    };
    expect(formatResult([1613], wrapped)).toBe(
      "1613 「例のページ」: article を削除",
    );
  });

  it("想定と違う形状なら例外を投げる", () => {
    expect(() => formatResult([1613], { unexpected: true })).toThrow(
      /"unexpected":true/,
    );
    expect(() => formatResult([1613], [{ results: [] }])).toThrow(
      /got 1.*"results":\[\]/,
    );
    expect(() =>
      formatResult(
        [1613],
        [
          { results: [{ id: 1613, title: "x" }], success: true },
          { success: true },
          { results: [], success: true },
          { results: [], success: true },
          { results: [], success: true },
          { results: [], success: true },
          { results: [], success: true },
        ],
      ),
    ).toThrow(/missing results.*"success":true/);
  });
});
