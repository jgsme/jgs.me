import { describe, expect, it } from "vitest";
import { isClip, parseEntry } from "./mf2";

const VALID = {
  type: ["h-entry"],
  properties: {
    name: ["記事タイトル"],
    content: ["本文の1行目\n本文の2行目"],
    published: ["2026-08-17T12:00:00+09:00"],
    category: ["tag1", "tag2"],
  },
};

describe("parseEntry", () => {
  it("h-entry の必須項目を取り出す", () => {
    const e = parseEntry(VALID);
    expect(e.name).toBe("記事タイトル");
    expect(e.content).toBe("本文の1行目\n本文の2行目");
    expect(e.categories).toEqual(["tag1", "tag2"]);
  });

  it("published を ISO8601 の UTC に正規化する", () => {
    const e = parseEntry(VALID);
    expect(e.published).toBe("2026-08-17T03:00:00.000Z");
  });

  it("content は素の文字列 (Scrapbox 記法) として受け取る", () => {
    const e = parseEntry({
      ...VALID,
      properties: { ...VALID.properties, content: ["[リンク] を含む行"] },
    });
    expect(e.content).toBe("[リンク] を含む行");
  });

  it("content が html 形式なら断る", () => {
    expect(() =>
      parseEntry({
        ...VALID,
        properties: { ...VALID.properties, content: [{ html: "<p>本文</p>" }] },
      }),
    ).toThrow(/html/);
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
      parseEntry({
        ...VALID,
        properties: { ...VALID.properties, name: "文字列" },
      }),
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

describe("isClip", () => {
  it("category に clip があれば true", () => {
    expect(isClip(["clip"])).toBe(true);
  });

  it("他の category と一緒でも true", () => {
    expect(isClip(["日記", "clip"])).toBe(true);
  });

  it("category が空なら false", () => {
    expect(isClip([])).toBe(false);
  });

  it("clip が無ければ false", () => {
    expect(isClip(["日記"])).toBe(false);
  });

  // タグは自分で打つので、大文字小文字を吸収する仕様にはしない。
  // 揺れを許すと「Clip と打ったのに記事になった」が起きたときに
  // 原因が分かりにくくなる。完全一致だけを見る。
  it("大文字混じりは false (完全一致のみ)", () => {
    expect(isClip(["Clip"])).toBe(false);
  });
});
