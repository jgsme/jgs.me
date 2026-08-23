import { describe, expect, it } from "vitest";
import { parseTargetURL } from "./target";

const SITE = "https://w.jgs.me";

describe("parseTargetURL", () => {
  it("/p/<n> は pageID", () => {
    expect(parseTargetURL(`${SITE}/p/12`, SITE)).toEqual({
      kind: "page",
      pageID: 12,
    });
  });

  // /o/<n> は ActivityPub の正準 id。pageID がそのまま入っている。
  it("/o/<n> も pageID", () => {
    expect(parseTargetURL(`${SITE}/o/12`, SITE)).toEqual({
      kind: "page",
      pageID: 12,
    });
  });

  // /a/<n> は article.id。page.id とはズレるので別扱いにする。
  it("/a/<n> は articleID", () => {
    expect(parseTargetURL(`${SITE}/a/12`, SITE)).toEqual({
      kind: "article",
      articleID: 12,
    });
  });

  it("/pages/<title> は題", () => {
    expect(parseTargetURL(`${SITE}/pages/foo`, SITE)).toEqual({
      kind: "title",
      title: "foo",
    });
  });

  it("percent-encoded な題を戻す", () => {
    expect(
      parseTargetURL(`${SITE}/pages/%E6%97%A5%E6%9C%AC%E8%AA%9E`, SITE),
    ).toEqual({ kind: "title", title: "日本語" });
  });

  it("末尾のスラッシュを許す", () => {
    expect(parseTargetURL(`${SITE}/pages/foo/`, SITE)).toEqual({
      kind: "title",
      title: "foo",
    });
  });

  // 別サイトの URL で自分の記事を消させない。
  it("別オリジンは弾く", () => {
    expect(() => parseTargetURL("https://evil.example/p/12", SITE)).toThrow();
    expect(() => parseTargetURL("http://w.jgs.me/p/12", SITE)).toThrow();
  });

  it("URL でないものは弾く", () => {
    expect(() => parseTargetURL("/p/12", SITE)).toThrow();
    expect(() => parseTargetURL("", SITE)).toThrow();
  });

  it("記事の URL でなければ弾く", () => {
    expect(() => parseTargetURL(`${SITE}/`, SITE)).toThrow();
    expect(() => parseTargetURL(`${SITE}/search`, SITE)).toThrow();
    expect(() => parseTargetURL(`${SITE}/pages/a/b`, SITE)).toThrow();
  });

  it("id が数値でなければ弾く", () => {
    expect(() => parseTargetURL(`${SITE}/p/abc`, SITE)).toThrow();
    expect(() => parseTargetURL(`${SITE}/p/0`, SITE)).toThrow();
    expect(() => parseTargetURL(`${SITE}/p/1.5`, SITE)).toThrow();
  });
});
