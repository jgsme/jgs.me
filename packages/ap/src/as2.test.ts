import { describe, expect, it } from "vitest";
import { summarize, toArticle, toISO, toNote } from "./as2";
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

  it("url は /p/<page.id>。改題しても変わらず、Bluesky に貼る URL と揃う", () => {
    expect(a.url).toBe("https://w.jgs.me/p/1234");
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

describe("toNote", () => {
  const page = {
    id: 42,
    title: "clip の題",
    created: "2026-08-29 01:00:00",
    updated: "2026-08-29 01:00:00",
  };

  it("type は Note", () => {
    expect(toNote(page, "<p>本文</p>").type).toBe("Note");
  });

  // id は page.id 由来。toArticle と同じ URI 体系に乗せる。
  it("id は /o/<page.id>", () => {
    expect(toNote(page, "<p>本文</p>").id).toBe("https://w.jgs.me/o/42");
  });

  // Mastodon は name を持つ Note を「題付き投稿」として特別扱いしない。
  // リンク共有として自然に出したいので name は出さない。
  it("name を持たない", () => {
    expect("name" in toNote(page, "<p>本文</p>")).toBe(false);
  });

  // summary は CW 欄になる。clip は短いので折り畳ませない。
  it("summary を持たない", () => {
    expect("summary" in toNote(page, "<p>本文</p>")).toBe(false);
  });

  it("published / updated を ISO8601 で出す", () => {
    const note = toNote(page, "<p>本文</p>");
    expect(note.published).toBe("2026-08-29T01:00:00.000Z");
    expect(note.updated).toBe("2026-08-29T01:00:00.000Z");
  });

  // 改題で壊れない URL を渡す。toArticle と同じ理由。
  it("url は /p/<page.id>", () => {
    expect(toNote(page, "<p>本文</p>").url).toBe("https://w.jgs.me/p/42");
  });

  it("公開範囲は Public", () => {
    expect(toNote(page, "<p>本文</p>").to).toEqual([
      "https://www.w3.org/ns/activitystreams#Public",
    ]);
  });
});
