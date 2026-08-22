import { describe, expect, it } from "vitest";
import { linkFacets } from "./facets";

describe("linkFacets", () => {
  it("ASCII のラベルの位置を返す", () => {
    const f = linkFacets("see link here", [
      { uri: "https://ex.com", label: "link" },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]!.index).toEqual({ byteStart: 4, byteEnd: 8 });
  });

  it("日本語の前にあるラベルは byte offset がずれる", () => {
    // "あいう" は UTF-8 で 9 バイト。
    const f = linkFacets("あいうlink", [
      { uri: "https://ex.com", label: "link" },
    ]);
    expect(f[0]!.index).toEqual({ byteStart: 9, byteEnd: 13 });
  });

  it("日本語のラベル自体もバイト長で測る", () => {
    const f = linkFacets("xリンクy", [
      { uri: "https://ex.com", label: "リンク" },
    ]);
    expect(f[0]!.index).toEqual({ byteStart: 1, byteEnd: 10 });
  });

  it("絵文字を挟んでも正しい", () => {
    // "😀" は UTF-8 で 4 バイト。
    const f = linkFacets("😀link", [{ uri: "https://ex.com", label: "link" }]);
    expect(f[0]!.index).toEqual({ byteStart: 4, byteEnd: 8 });
  });

  it("features に link 型と uri が入る", () => {
    const f = linkFacets("link", [{ uri: "https://ex.com", label: "link" }]);
    expect(f[0]!.features).toEqual([
      { $type: "app.bsky.richtext.facet#link", uri: "https://ex.com" },
    ]);
    expect(f[0]!.$type).toBe("app.bsky.richtext.facet");
  });

  it("複数のリンクをそれぞれ返す", () => {
    const f = linkFacets("a b", [
      { uri: "https://x.com", label: "a" },
      { uri: "https://y.com", label: "b" },
    ]);
    expect(f).toHaveLength(2);
    expect(f[0]!.index.byteStart).toBe(0);
    expect(f[1]!.index.byteStart).toBe(2);
  });

  it("同じラベルが複数回出たら最初の1つだけ", () => {
    const f = linkFacets("a a", [{ uri: "https://x.com", label: "a" }]);
    expect(f).toHaveLength(1);
    expect(f[0]!.index.byteStart).toBe(0);
  });

  it("テキストに現れないラベルは facet を作らない", () => {
    expect(linkFacets("abc", [{ uri: "https://x.com", label: "zzz" }])).toEqual(
      [],
    );
  });

  it("空のリンク一覧なら空配列", () => {
    expect(linkFacets("abc", [])).toEqual([]);
  });
});
