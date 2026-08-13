import { describe, it, expect } from "vitest";
import { routeTitleToPageTitle } from "./routeTitle";

// Vike の routeParams は %2F を除いてデコード済みで渡ってくる。
// 全体を decodeURIComponent すると "%キ" のような % を含むタイトルが URIError で 500 になり、
// 逆に何もしないと "dev.to%2Fjgs" のようにスラッシュが復元されず DB を引けない。
describe("routeTitleToPageTitle", () => {
  it("% を含むタイトルをそのまま返す", () => {
    expect(routeTitleToPageTitle("1uオンリーの40-60%キーボード")).toBe(
      "1uオンリーの40-60%キーボード",
    );
  });

  it("% の後ろが16進数に見えてもデコードしない", () => {
    expect(routeTitleToPageTitle("進捗100%25達成")).toBe("進捗100%25達成");
  });

  it("% を含まないタイトルはそのまま返す", () => {
    expect(routeTitleToPageTitle("1uオンリー")).toBe("1uオンリー");
  });

  it("%2F はスラッシュに戻す", () => {
    expect(
      routeTitleToPageTitle("Tofu キーボードを組み立てた - dev.to%2Fjgs"),
    ).toBe("Tofu キーボードを組み立てた - dev.to/jgs");
  });

  it("%2F が複数あってもすべて戻す", () => {
    expect(routeTitleToPageTitle("a%2Fb%2Fc")).toBe("a/b/c");
  });

  it("小文字の %2f も戻す", () => {
    expect(routeTitleToPageTitle("a%2fb")).toBe("a/b");
  });
});
