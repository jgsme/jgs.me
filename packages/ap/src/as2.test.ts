import { describe, expect, it } from "vitest";
import { summarize, toArticle, toISO } from "./as2";
import { ACTOR_URI } from "./actor";

const PAGE = {
  id: 1234,
  title: "テスト記事",
  created: "2026-08-01T12:00:00.000Z",
  updated: "2026-08-02T09:30:00.000Z",
};

describe("summarize", () => {
  it("HTML タグを落としてテキストだけにする", () => {
    expect(summarize("<p>こんにちは</p>")).toBe("こんにちは");
  });

  it("連続する空白と改行を1つに畳む", () => {
    expect(summarize("<p>あ\n\n  い</p>")).toBe("あ い");
  });

  it("maxLength を超えたら切り詰めて … を付ける", () => {
    expect(summarize("<p>あいうえお</p>", 3)).toBe("あいう…");
  });

  it("maxLength ちょうどなら … を付けない", () => {
    expect(summarize("<p>あいう</p>", 3)).toBe("あいう");
  });

  it("空の HTML では空文字を返す", () => {
    expect(summarize("")).toBe("");
  });

  it("ブロックの境目で語をつなげない", () => {
    expect(summarize("<p>あ</p><p>い</p>")).toBe("あ い");
  });

  it("リストも項目が連結しない", () => {
    expect(summarize("<ul><li>あ</li><li>い</li></ul>")).toBe("あ い");
  });

  it("HTML エンティティを戻す (CW 欄はプレーンテキスト)", () => {
    expect(summarize("<p>&lt;b&gt; &amp; x</p>")).toBe("<b> & x");
  });

  it("&amp;lt; を二重にデコードしない", () => {
    expect(summarize("<p>&amp;lt;</p>")).toBe("&lt;");
  });
});

describe("toISO", () => {
  it("D1 の CURRENT_TIMESTAMP 形式を UTC の ISO8601 にする", () => {
    expect(toISO("2020-04-02 09:34:00")).toBe("2020-04-02T09:34:00.000Z");
  });

  it("既に ISO8601 ならそのまま", () => {
    expect(toISO("2026-08-01T12:00:00.000Z")).toBe("2026-08-01T12:00:00.000Z");
  });

  it("秒までの ISO8601 もミリ秒付きに揃える", () => {
    expect(toISO("2026-08-01T12:00:00Z")).toBe("2026-08-01T12:00:00.000Z");
  });

  it("空文字はそのまま", () => {
    expect(toISO("")).toBe("");
  });

  it("日付として読めない値は捏造せずそのまま返す", () => {
    expect(toISO("not-a-date")).toBe("not-a-date");
  });
});

describe("toArticle", () => {
  const a = toArticle(PAGE, "<p>本文</p>");

  it("id は /o/<page.id> で、改題しても変わらない不変の URI", () => {
    expect(a.id).toBe("https://w.jgs.me/o/1234");
  });

  it("url は人間向けの /pages/<title>", () => {
    expect(a.url).toBe(
      "https://w.jgs.me/pages/%E3%83%86%E3%82%B9%E3%83%88%E8%A8%98%E4%BA%8B",
    );
  });

  it("type は Article (long-form 対応実装で全文表示させるため)", () => {
    expect(a.type).toBe("Article");
  });

  it("content には全文がそのまま入る", () => {
    expect(a.content).toBe("<p>本文</p>");
  });

  it("summary には抜粋が入る", () => {
    expect(a.summary).toBe("本文");
  });

  it("name は記事タイトル", () => {
    expect(a.name).toBe("テスト記事");
  });

  it("published と updated が両方入る (Mastodon は updated が無いと Update を処理しない)", () => {
    expect(a.published).toBe("2026-08-01T12:00:00.000Z");
    expect(a.updated).toBe("2026-08-02T09:30:00.000Z");
  });

  it("attributedTo は actor", () => {
    expect(a.attributedTo).toBe(ACTOR_URI);
  });

  it("to は Public のみ (followers-only を作らない)", () => {
    expect(a.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
  });

  it("@context に ActivityStreams が入る", () => {
    expect(a["@context"]).toContain("https://www.w3.org/ns/activitystreams");
  });

  it("D1 由来の日時を xsd:dateTime に正規化する", () => {
    const b = toArticle(
      {
        id: 1,
        title: "t",
        created: "2020-04-02 09:34:00",
        updated: "2023-04-04 03:37:35",
      },
      "<p>x</p>",
    );
    expect(b.published).toBe("2020-04-02T09:34:00.000Z");
    expect(b.updated).toBe("2023-04-04T03:37:35.000Z");
  });
});
