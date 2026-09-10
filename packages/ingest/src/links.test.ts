import { describe, expect, it } from "vitest";
import { extractLinks } from "./links";

// リンク判定は web の ScrapboxNode.tsx と同じ条件 (pathType === "relative") で
// なければならない。ここがずれると「画面上はリンクなのに索引に無い」が起きる。
describe("extractLinks", () => {
  it("[foo] を拾う", () => {
    expect(extractLinks("題\n[foo] を見た")).toEqual(["foo"]);
  });

  it("#foo を拾う", () => {
    expect(extractLinks("題\n#foo だった")).toEqual(["foo"]);
  });

  it("外部 URL は拾わない", () => {
    expect(extractLinks("題\n[https://example.com/ 例]")).toEqual([]);
  });

  it("自分の題は落とす", () => {
    expect(extractLinks("題\n[題] と [foo]")).toEqual(["foo"]);
  });

  it("同じ題への複数のリンクは 1 件にまとまる", () => {
    expect(extractLinks("題\n[foo]\n[foo]\n#foo")).toEqual(["foo"]);
  });

  it("初出順で返す", () => {
    expect(extractLinks("題\n[b]\n[a]")).toEqual(["b", "a"]);
  });

  it("装飾の中のリンクも拾う", () => {
    expect(extractLinks("題\n[* [foo]]")).toEqual(["foo"]);
  });

  it("表の中のリンクも拾う", () => {
    expect(extractLinks("題\ntable:t\n\t[foo]\t[bar]")).toEqual(["foo", "bar"]);
  });

  it("コードブロックの中は拾わない", () => {
    expect(extractLinks("題\ncode:x\n\t[foo]")).toEqual([]);
  });

  it("題だけの本文では空", () => {
    expect(extractLinks("題")).toEqual([]);
  });

  it("空文字では空", () => {
    expect(extractLinks("")).toEqual([]);
  });
});
