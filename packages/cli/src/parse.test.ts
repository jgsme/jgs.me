import { describe, expect, it } from "vitest";
import { parseTarget } from "./parse.ts";

describe("parseTarget", () => {
  it("/p/:id 形式の URL から pageID を取り出す", () => {
    expect(parseTarget("https://w.jgsw.workers.dev/p/1613")).toBe(1613);
  });

  it("末尾のスラッシュを許容する", () => {
    expect(parseTarget("https://w.jgsw.workers.dev/p/1613/")).toBe(1613);
  });

  it("クエリ文字列を無視する", () => {
    expect(parseTarget("https://w.jgsw.workers.dev/p/1613?x=1")).toBe(1613);
  });

  it("裸の ID を受け付ける", () => {
    expect(parseTarget("1613")).toBe(1613);
  });

  it("/a/:id は article.id なので拒否する", () => {
    expect(parseTarget("https://w.jgsw.workers.dev/a/1613")).toBeNull();
  });

  it("/pages/:title は拒否する", () => {
    expect(parseTarget("https://w.jgsw.workers.dev/pages/foo")).toBeNull();
  });

  it("0 以下の ID は拒否する", () => {
    expect(parseTarget("0")).toBeNull();
    expect(parseTarget("-1")).toBeNull();
  });

  it("整数でない値は拒否する", () => {
    expect(parseTarget("1.5")).toBeNull();
    expect(parseTarget("abc")).toBeNull();
    expect(parseTarget("")).toBeNull();
  });

  it("URL でも ID でもない文字列は拒否する", () => {
    expect(parseTarget("https://example.com/")).toBeNull();
  });
});
