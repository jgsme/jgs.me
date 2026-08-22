import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, MAX_REDIRECTS, guardURL } from "./urlguard";

const ok = (u: string) => guardURL(u).ok;
const reason = (u: string) => {
  const r = guardURL(u);
  return r.ok ? null : r.reason;
};

describe("guardURL", () => {
  it("https を許す", () => {
    expect(ok("https://example.com/post/1")).toBe(true);
  });

  it("http を許す", () => {
    expect(ok("http://example.com/post/1")).toBe(true);
  });

  it("file: を拒否する", () => {
    expect(reason("file:///etc/passwd")).toBe("scheme");
  });

  it("javascript: を拒否する", () => {
    expect(reason("javascript:alert(1)")).toBe("scheme");
  });

  it("data: を拒否する", () => {
    expect(reason("data:text/html,x")).toBe("scheme");
  });

  it("localhost を拒否する", () => {
    expect(reason("http://localhost/")).toBe("host");
  });

  it("localhost のサブドメインを拒否する", () => {
    expect(reason("http://foo.localhost/")).toBe("host");
  });

  it("IPv4 リテラルを拒否する", () => {
    expect(reason("http://127.0.0.1/")).toBe("host");
    expect(reason("http://10.0.0.1/")).toBe("host");
    expect(reason("http://192.168.1.1/")).toBe("host");
    expect(reason("http://169.254.169.254/")).toBe("host");
    expect(reason("http://8.8.8.8/")).toBe("host");
  });

  // WHATWG の URL パーサは 10進/16進表記の IPv4 をドット区切りに正規化する。
  // hostname を見る時点で 127.0.0.1 になっているので、正規表現で足りる。
  // 自明でないのでテストで固定する。
  it("10進表記の IPv4 を拒否する", () => {
    expect(reason("http://2130706433/")).toBe("host");
  });

  it("16進表記の IPv4 を拒否する", () => {
    expect(reason("http://0x7f000001/")).toBe("host");
  });

  it("IPv6 リテラルを拒否する", () => {
    expect(reason("http://[::1]/")).toBe("host");
    expect(reason("http://[fd00::1]/")).toBe("host");
  });

  it("URL として読めなければ拒否する", () => {
    expect(reason("not a url")).toBe("parse");
  });

  // "https:///path" は WHATWG が host を "path" に正規化してしまうので
  // ホスト空のテストにならない。new URL が投げる形を使う。
  it("ホストが無い http/https を拒否する", () => {
    expect(reason("https://")).toBe("parse");
  });

  it("通った場合は URL を返す", () => {
    const r = guardURL("https://example.com/a?b=1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.href).toBe("https://example.com/a?b=1");
  });

  it("リダイレクト上限は 5", () => {
    expect(MAX_REDIRECTS).toBe(5);
  });

  it("本文の上限は 1MB", () => {
    expect(MAX_BODY_BYTES).toBe(1_000_000);
  });
});
