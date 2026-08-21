import { describe, expect, it } from "vitest";
import { parseTarget } from "./webmention";

const SITE = "https://w.jgs.me";
const p = (t: string) => parseTarget(t, SITE);

describe("parseTarget", () => {
  it("/o/<n> を id として読む", () => {
    expect(p("https://w.jgs.me/o/42")).toEqual({ by: "id", id: 42 });
  });

  it("/p/<n> を id として読む", () => {
    expect(p("https://w.jgs.me/p/7")).toEqual({ by: "id", id: 7 });
  });

  it("末尾スラッシュを許す", () => {
    expect(p("https://w.jgs.me/o/42/")).toEqual({ by: "id", id: 42 });
  });

  it("/pages/<title> を title として読む", () => {
    expect(p("https://w.jgs.me/pages/hello")).toEqual({
      by: "title",
      title: "hello",
    });
  });

  it("percent encode されたタイトルを戻す", () => {
    expect(p("https://w.jgs.me/pages/%E6%97%A5%E8%A8%98")).toEqual({
      by: "title",
      title: "日記",
    });
  });

  // "%キ" のような % を含むタイトルが実在する (routeTitle.ts)。
  // decodeURIComponent が URIError を投げると consumer が retry ループに入る。
  it("decode できないタイトルはそのまま返す", () => {
    expect(p("https://w.jgs.me/pages/%キ")).toEqual({
      by: "title",
      title: "%キ",
    });
  });

  it("別ホストは null", () => {
    expect(p("https://evil.example/o/42")).toBeNull();
  });

  it("スキームが違えば null", () => {
    expect(p("http://w.jgs.me/o/42")).toBeNull();
  });

  it("知らないパスは null", () => {
    expect(p("https://w.jgs.me/clips")).toBeNull();
    expect(p("https://w.jgs.me/")).toBeNull();
    expect(p("https://w.jgs.me/o/abc")).toBeNull();
  });

  it("URL として読めなければ null", () => {
    expect(p("not a url")).toBeNull();
  });
});
