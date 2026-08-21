import { describe, expect, it } from "vitest";
import { sameURL } from "./sameurl";

const T = "https://w.jgs.me/o/42";

describe("sameURL", () => {
  it("同じ URL", () => {
    expect(sameURL(T, T)).toBe(true);
  });

  // 相手のリンクが http で書かれていても同じ記事を指す。
  it("スキームの差を無視する", () => {
    expect(sameURL("http://w.jgs.me/o/42", T)).toBe(true);
  });

  it("末尾スラッシュの差を無視する", () => {
    expect(sameURL("https://w.jgs.me/o/42/", T)).toBe(true);
  });

  it("フラグメントを無視する", () => {
    expect(sameURL("https://w.jgs.me/o/42#comment", T)).toBe(true);
  });

  it("ホスト名の大小を無視する", () => {
    expect(sameURL("https://W.JGS.ME/o/42", T)).toBe(true);
  });

  it("デフォルトポートを無視する", () => {
    expect(sameURL("https://w.jgs.me:443/o/42", T)).toBe(true);
  });

  it("非デフォルトポートは区別する", () => {
    expect(sameURL("https://w.jgs.me:8443/o/42", T)).toBe(false);
  });

  it("パスが違えば false", () => {
    expect(sameURL("https://w.jgs.me/o/43", T)).toBe(false);
  });

  it("ホストが違えば false", () => {
    expect(sameURL("https://evil.example/o/42", T)).toBe(false);
  });

  it("クエリの差は区別する", () => {
    expect(sameURL("https://w.jgs.me/o/42?x=1", T)).toBe(false);
  });

  // source の HTML に相対リンクがあっても、target は常に絶対 URL。
  // 相対 URL が自サイトを指すことはないので false でよい。
  it("相対 URL は false", () => {
    expect(sameURL("/o/42", T)).toBe(false);
  });

  it("URL として読めなければ false", () => {
    expect(sameURL("not a url", T)).toBe(false);
  });

  it("http/https 以外は false", () => {
    expect(sameURL("javascript:alert(1)", T)).toBe(false);
  });

  // パス末尾のスラッシュだけを落とす。ルートは "" に潰れて両者一致する。
  it("ルート同士は一致する", () => {
    expect(sameURL("http://example.com", "https://example.com/")).toBe(true);
  });
});
