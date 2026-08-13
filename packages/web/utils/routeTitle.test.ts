import { describe, it, expect } from "vitest";
import { routeTitleToPageTitle } from "./routeTitle";

// Vike の routeParams はデコード済みで渡ってくるので、ここで再度デコードしてはいけない。
// デコードすると "%キ" のような % を含むタイトルが URIError で 500 になる。
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
});
