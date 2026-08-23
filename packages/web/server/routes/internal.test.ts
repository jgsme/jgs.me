import { describe, expect, it } from "vitest";
import { parsePurgePaths } from "./internal";

describe("parsePurgePaths", () => {
  it("スラッシュ始まりのパスの配列を通す", () => {
    expect(parsePurgePaths(["/pages/foo", "/a/12", "/"])).toEqual([
      "/pages/foo",
      "/a/12",
      "/",
    ]);
  });

  it("配列でなければ弾く", () => {
    expect(() => parsePurgePaths("/pages/foo")).toThrow();
    expect(() => parsePurgePaths(null)).toThrow();
    expect(() => parsePurgePaths({ paths: ["/"] })).toThrow();
  });

  it("空配列は弾く", () => {
    expect(() => parsePurgePaths([])).toThrow();
  });

  it("文字列でない要素は弾く", () => {
    expect(() => parsePurgePaths(["/pages/foo", 12])).toThrow();
  });

  // 絶対 URL を許すと、キャッシュキーの組み立て先を呼び出し側が決められる。
  // 消す対象は必ず自サイトのパスに閉じる。
  it("絶対 URL は弾く", () => {
    expect(() => parsePurgePaths(["https://evil.example/pages/foo"])).toThrow();
  });

  // "//evil.example/x" は new URL(path, SITE_URL) で別ホストに解決される。
  it("プロトコル相対 URL は弾く", () => {
    expect(() => parsePurgePaths(["//evil.example/x"])).toThrow();
  });

  it("スラッシュで始まらないものは弾く", () => {
    expect(() => parsePurgePaths(["pages/foo"])).toThrow();
    expect(() => parsePurgePaths([""])).toThrow();
  });

  // ブラウザ以外の経路で "\" が "/" と解釈される実装があるため、含むものは通さない。
  it("バックスラッシュを含むものは弾く", () => {
    expect(() => parsePurgePaths(["/pages\\foo"])).toThrow();
    expect(() => parsePurgePaths(["/\\evil.example/x"])).toThrow();
  });

  // 1 リクエストで無制限にループさせない。
  it("上限を超える件数は弾く", () => {
    const many = Array.from({ length: 101 }, (_, i) => `/p/${i}`);
    expect(() => parsePurgePaths(many)).toThrow();
    expect(parsePurgePaths(many.slice(0, 100))).toHaveLength(100);
  });
});
