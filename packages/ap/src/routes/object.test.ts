import { describe, expect, it } from "vitest";
import { wantsActivityJson } from "./object";

describe("wantsActivityJson", () => {
  it("application/activity+json を要求されたら true", () => {
    expect(wantsActivityJson("application/activity+json")).toBe(true);
  });

  it("ld+json のプロファイル付きでも true", () => {
    expect(
      wantsActivityJson(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      ),
    ).toBe(true);
  });

  it("複数の Accept に混ざっていても true", () => {
    expect(
      wantsActivityJson("text/html, application/activity+json;q=0.9"),
    ).toBe(true);
  });

  it("ブラウザの Accept なら false", () => {
    expect(
      wantsActivityJson("text/html,application/xhtml+xml,image/webp,*/*;q=0.8"),
    ).toBe(false);
  });

  it("Accept が無ければ false", () => {
    expect(wantsActivityJson(null)).toBe(false);
  });

  it("*/* だけなら false (ブラウザ扱い)", () => {
    expect(wantsActivityJson("*/*")).toBe(false);
  });
});
