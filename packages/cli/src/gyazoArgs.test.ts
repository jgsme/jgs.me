import { describe, expect, it } from "vitest";
import { parseGyazoArgs } from "./gyazoArgs.ts";

describe("parseGyazoArgs", () => {
  it("コマンドだけなら既定値で返す", () => {
    expect(parseGyazoArgs(["scan"])).toEqual({
      command: "scan",
      maxPages: null,
      target: "article",
    });
  });

  it("--target clip を読む", () => {
    expect(parseGyazoArgs(["scan", "--target", "clip"])).toEqual({
      command: "scan",
      maxPages: null,
      target: "clip",
    });
  });

  it("--pages と --target を同時に読む", () => {
    expect(
      parseGyazoArgs(["rewrite", "--pages", "20", "--target", "clip"]),
    ).toEqual({ command: "rewrite", maxPages: 20, target: "clip" });
  });

  it("知らないコマンドは null にする", () => {
    expect(parseGyazoArgs(["migrate"])).toBeNull();
  });

  it("引数なしは null にする", () => {
    expect(parseGyazoArgs([])).toBeNull();
  });

  it("知らない target は null にする", () => {
    expect(parseGyazoArgs(["scan", "--target", "excluded"])).toBeNull();
  });

  it("--target の値が無いなら null にする", () => {
    expect(parseGyazoArgs(["scan", "--target"])).toBeNull();
  });

  it("数値でない --pages は null にする", () => {
    expect(parseGyazoArgs(["rewrite", "--pages", "たくさん"])).toBeNull();
  });

  // --pages 0 を通すと rewrite が 1 ページも処理しないまま「完了」と出る。
  // 打ち間違いを黙って飲まない。
  it("1 未満の --pages は null にする", () => {
    expect(parseGyazoArgs(["rewrite", "--pages", "0"])).toBeNull();
  });
});
