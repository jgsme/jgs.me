import { describe, expect, it } from "vitest";
import { parseEntry } from "./mf2";

const VALID = {
  type: ["h-entry"],
  properties: {
    name: ["記事タイトル"],
    content: [{ html: "<p>本文</p>" }],
    published: ["2026-08-17T12:00:00+09:00"],
    category: ["tag1", "tag2"],
  },
};

describe("parseEntry", () => {
  it("h-entry の必須項目を取り出す", () => {
    const e = parseEntry(VALID);
    expect(e.name).toBe("記事タイトル");
    expect(e.contentHtml).toBe("<p>本文</p>");
    expect(e.categories).toEqual(["tag1", "tag2"]);
  });

  it("published を ISO8601 の UTC に正規化する", () => {
    const e = parseEntry(VALID);
    expect(e.published).toBe("2026-08-17T03:00:00.000Z");
  });

  it("content が素の文字列でも受け取る", () => {
    const e = parseEntry({
      ...VALID,
      properties: { ...VALID.properties, content: ["ただのテキスト"] },
    });
    expect(e.contentHtml).toBe("ただのテキスト");
  });

  it("category が無ければ空配列", () => {
    const { category, ...rest } = VALID.properties;
    const e = parseEntry({ ...VALID, properties: rest });
    expect(e.categories).toEqual([]);
  });

  it("published が無ければ現在時刻ではなく空文字を返す (呼び出し側が決める)", () => {
    const { published, ...rest } = VALID.properties;
    const e = parseEntry({ ...VALID, properties: rest });
    expect(e.published).toBe("");
  });

  it("in-reply-to を取り出す", () => {
    const e = parseEntry({
      ...VALID,
      properties: {
        ...VALID.properties,
        "in-reply-to": ["https://example.com/post/1"],
      },
    });
    expect(e.inReplyTo).toBe("https://example.com/post/1");
  });

  it("in-reply-to が無ければ null", () => {
    expect(parseEntry(VALID).inReplyTo).toBeNull();
  });

  it("photo を取り出す", () => {
    const e = parseEntry({
      ...VALID,
      properties: { ...VALID.properties, photo: ["https://img.example/a.png"] },
    });
    expect(e.photo).toBe("https://img.example/a.png");
  });

  it("type が h-entry でなければ throw", () => {
    expect(() => parseEntry({ ...VALID, type: ["h-card"] })).toThrow(
      "type must be h-entry",
    );
  });

  it("type が無ければ throw", () => {
    expect(() => parseEntry({ properties: VALID.properties })).toThrow(
      "type must be h-entry",
    );
  });

  it("properties が無ければ throw", () => {
    expect(() => parseEntry({ type: ["h-entry"] })).toThrow(
      "properties is required",
    );
  });

  it("name が無ければ throw", () => {
    const { name, ...rest } = VALID.properties;
    expect(() => parseEntry({ ...VALID, properties: rest })).toThrow(
      "name is required",
    );
  });

  it("content が無ければ throw", () => {
    const { content, ...rest } = VALID.properties;
    expect(() => parseEntry({ ...VALID, properties: rest })).toThrow(
      "content is required",
    );
  });

  it("値が配列でなければ throw (Micropub は全値が配列)", () => {
    expect(() =>
      parseEntry({ ...VALID, properties: { ...VALID.properties, name: "文字列" } }),
    ).toThrow("name is required");
  });

  it("payload が object でなければ throw", () => {
    expect(() => parseEntry(null)).toThrow("properties is required");
    expect(() => parseEntry("文字列")).toThrow("properties is required");
  });

  it("published が不正な日付なら throw", () => {
    expect(() =>
      parseEntry({
        ...VALID,
        properties: { ...VALID.properties, published: ["not-a-date"] },
      }),
    ).toThrow("published is not a valid date");
  });
});
