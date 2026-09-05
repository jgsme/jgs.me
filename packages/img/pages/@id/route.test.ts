import { describe, expect, it } from "vitest";
import type { PageContextServer } from "vike/types";
import route from "./+route";

const call = (urlPathname: string) =>
  (route as (c: { urlPathname: string }) => unknown)({
    urlPathname,
  } as PageContextServer);

const ID = "a".repeat(64);

describe("/@id のルート", () => {
  it("64 桁 hex は routeParams.id として通す", () => {
    expect(call(`/${ID}`)).toEqual({ routeParams: { id: ID } });
  });

  // sha256 の形でないパスは D1 を引く前に落とす。
  it("64 桁 hex でなければ当たらない", () => {
    expect(call("/notahash")).toBe(false);
    expect(call(`/${"z".repeat(64)}`)).toBe(false);
    expect(call(`/${"a".repeat(63)}`)).toBe(false);
    expect(call(`/${"a".repeat(65)}`)).toBe(false);
  });

  // 大文字の hex は投稿側が作らない。両方通すと同じ画像に 2 つの URL ができる。
  it("大文字の hex は当たらない", () => {
    expect(call(`/${"A".repeat(64)}`)).toBe(false);
  });

  it("階層が深いパスは当たらない", () => {
    expect(call(`/x/${ID}`)).toBe(false);
  });

  it("favicon などの雑多なリクエストは当たらない", () => {
    expect(call("/favicon.ico")).toBe(false);
    expect(call("/")).toBe(false);
  });
});
