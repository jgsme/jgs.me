import { describe, expect, it } from "vitest";
import {
  formatMdBackfillReport,
  type MdBackfillItem,
} from "./mdBackfillReport.ts";

const item = (over: Partial<MdBackfillItem> = {}): MdBackfillItem => ({
  pageId: 1,
  title: "題1",
  written: true,
  ...over,
});

describe("formatMdBackfillReport", () => {
  it("書けた件数を出す", () => {
    expect(formatMdBackfillReport([item(), item({ pageId: 2 })])).toBe(
      "書いた: 2",
    );
  });

  // 本文が R2 に無い page は実在する。エラーではないので分けて数えるが、
  // どれが欠けているかは知りたいので列挙する。
  it("本文が無くて飛ばしたページを列挙する", () => {
    expect(
      formatMdBackfillReport([
        item(),
        item({ pageId: 2, title: "題2", written: false }),
      ]),
    ).toBe(
      ["書いた: 1", "", "本文が無くて飛ばした page:", "  2 題2"].join("\n"),
    );
  });

  it("失敗したページを列挙する", () => {
    expect(
      formatMdBackfillReport([
        item(),
        item({ pageId: 2, title: "題2", written: false, error: "boom" }),
      ]),
    ).toBe(["書いた: 1", "", "書けなかった page:", "  2 題2: boom"].join("\n"));
  });

  it("1 件も無ければそう言う", () => {
    expect(formatMdBackfillReport([])).toBe("書いた: 0");
  });
});
