import { describe, expect, it } from "vitest";
import {
  formatResult,
  hasRegistrations,
  parseChanges,
  parseRows,
} from "./format.ts";

/** wrangler d1 execute --command "<集約 SELECT>" --json の実測出力 */
const SELECT_OUTPUT = [
  {
    results: [
      {
        id: 6216,
        title: "祝 冬HIF編 開幕",
        in_article: 1,
        in_clip: 0,
        in_excluded: 0,
      },
      {
        id: 6217,
        title: "20260522",
        in_article: 0,
        in_clip: 0,
        in_excluded: 0,
      },
    ],
    success: true,
    meta: { changes: 0, rows_read: 7592 },
  },
];

/** wrangler d1 execute --command "..." --json の実測 meta */
const DELETE_OUTPUT = [
  {
    results: [],
    success: true,
    meta: {
      served_by: "v3-prod",
      duration: 0.134,
      changes: 1,
      last_row_id: 0,
      changed_db: true,
      rows_read: 2,
      rows_written: 1,
      total_attempts: 1,
    },
  },
];

const NO_CHANGES = { article: 0, clip: 0, excluded_page: 0 } as const;

function row(
  id: number,
  title: string,
  presence: {
    in_article?: number;
    in_clip?: number;
    in_excluded?: number;
  } = {},
) {
  return {
    id,
    title,
    in_article: 0,
    in_clip: 0,
    in_excluded: 0,
    ...presence,
  };
}

describe("parseRows", () => {
  it("実測の SELECT 出力から行の配列を取り出す", () => {
    expect(parseRows(SELECT_OUTPUT)).toEqual(SELECT_OUTPUT[0].results);
  });

  it("results が空なら空配列", () => {
    expect(parseRows([{ results: [], success: true }])).toEqual([]);
  });

  it("トップレベルが配列でなければ例外", () => {
    expect(() => parseRows({ unexpected: true })).toThrow(/"unexpected":true/);
  });

  it("配列が空なら例外", () => {
    expect(() => parseRows([])).toThrow();
  });

  it("results がなければ例外", () => {
    expect(() => parseRows([{ success: true }])).toThrow(/"success":true/);
  });

  it("results が配列でなければ例外", () => {
    expect(() => parseRows([{ results: "x" }])).toThrow(/"results":"x"/);
  });
});

describe("parseChanges", () => {
  it("実測の出力から meta.changes を取り出す", () => {
    expect(parseChanges(DELETE_OUTPUT)).toBe(1);
    expect(parseChanges(SELECT_OUTPUT)).toBe(0);
  });

  it("meta がなければ例外", () => {
    expect(() => parseChanges([{ results: [], success: true }])).toThrow(
      /"success":true/,
    );
  });

  it("changes が数値でなければ例外", () => {
    expect(() => parseChanges([{ meta: { changes: "1" } }])).toThrow(
      /"changes":"1"/,
    );
  });

  it("トップレベルが配列でなければ例外", () => {
    expect(() => parseChanges({ unexpected: true })).toThrow(
      /"unexpected":true/,
    );
  });
});

describe("hasRegistrations", () => {
  it("どこかに在籍していれば true", () => {
    expect(hasRegistrations(parseRows(SELECT_OUTPUT))).toBe(true);
  });

  it("どこにも在籍していなければ false", () => {
    expect(hasRegistrations([row(6217, "20260522")])).toBe(false);
  });

  it("行が空なら false", () => {
    expect(hasRegistrations([])).toBe(false);
  });

  it("id が数値として読めなければ例外", () => {
    expect(() => hasRegistrations([{ pageID: 6216 }])).toThrow(/"pageID":6216/);
  });
});

describe("formatResult", () => {
  it("在籍していたテーブルを削除したものとして報告し、合計行を足す", () => {
    const text = formatResult(
      [6216],
      [row(6216, "祝 冬HIF編 開幕", { in_article: 1 })],
      { ...NO_CHANGES, article: 1 },
    );
    expect(text).toBe(
      "6216 「祝 冬HIF編 開幕」: article を削除\n→ 計 1 行削除",
    );
  });

  it("複数テーブル在籍なら TARGET_TABLES の順で並べる", () => {
    const text = formatResult(
      [1612],
      [row(1612, "別のページ", { in_clip: 1, in_excluded: 1 })],
      { ...NO_CHANGES, clip: 1, excluded_page: 1 },
    );
    expect(text).toBe(
      "1612 「別のページ」: clip, excluded_page を削除\n→ 計 2 行削除",
    );
  });

  it("どこにも在籍していなければ「もともと未登録」で合計行は出さない", () => {
    const text = formatResult([6217], [row(6217, "20260522")], NO_CHANGES);
    expect(text).toBe("6217 「20260522」: もともと未登録");
  });

  it("行が返らなかった ID は page が存在しないと出す", () => {
    expect(formatResult([999999999], [], NO_CHANGES)).toBe(
      "999999999: page が存在しない",
    );
  });

  it("行が id 昇順で来ても引数の順で並べ直す", () => {
    const text = formatResult(
      [6217, 6216, 999999999],
      parseRows(SELECT_OUTPUT),
      { ...NO_CHANGES, article: 1 },
    );
    expect(text).toBe(
      [
        "6217 「20260522」: もともと未登録",
        "6216 「祝 冬HIF編 開幕」: article を削除",
        "999999999: page が存在しない",
        "→ 計 1 行削除",
      ].join("\n"),
    );
  });

  it("予測と実際の削除数が食い違えば合計行の代わりに警告を出す", () => {
    const text = formatResult(
      [6216],
      [row(6216, "祝 冬HIF編 開幕", { in_article: 1 })],
      { ...NO_CHANGES, article: 2 },
    );
    expect(text).toBe(
      "6216 「祝 冬HIF編 開幕」: article を削除\n→ 警告: 1 行削除される見込みだったが、実際には 2 行削除された",
    );
  });

  it("全部未登録なら合計行も警告も出さない", () => {
    const text = formatResult(
      [6217, 999999999],
      [row(6217, "20260522")],
      NO_CHANGES,
    );
    expect(text).toBe(
      "6217 「20260522」: もともと未登録\n999999999: page が存在しない",
    );
  });

  it("id が数値として読めなければ例外", () => {
    expect(() => formatResult([6216], [{ pageID: 6216 }], NO_CHANGES)).toThrow(
      /"pageID":6216/,
    );
  });
});
