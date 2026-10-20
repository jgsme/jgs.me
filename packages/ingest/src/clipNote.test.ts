import { describe, expect, it } from "vitest";
import { buildClipNote, normalizeForHash, toIsoDatetime } from "./clipNote";

const created = "2022-09-21 12:34:56";
const TAGS_MAX = 10;
const TAGS_GIVEN = TAGS_MAX + 2;

const note = (body: string, title = "題") =>
  buildClipNote({ title, created, body });

describe("buildClipNote", () => {
  it("diary の link clip は card の URL を出典にして bookmarking にする", async () => {
    const body = [
      "Ladle | Ladle",
      "code:card",
      ' {"url":"https://www.ladle.dev/","title":"Ladle | Ladle"}',
      "",
      "[https://r2.jgs.me/abc.png]",
      "[Storybook] と互換性があるらしい",
      "",
      "#Uber",
    ].join("\n");

    const r = await note(body, "Ladle | Ladle");

    expect(r.note.motivation).toBe("bookmarking");
    expect(r.note.target.source).toBe("https://www.ladle.dev/");
    expect(r.note.target.title).toBe("Ladle | Ladle");
    expect(r.note.target.selector).toBeUndefined();
    expect(r.note.body?.value).toBe("Storybook と互換性があるらしい");
    expect(r.note.tags).toEqual(["Uber"]);
    expect(r.note.createdAt).toBe("2022-09-21T12:34:56.000Z");
    expect(r.warnings).toEqual([]);
  });

  it("アーカイブの [題 URL] 行は出典にし、内部リンクだけの行は tags にする", async () => {
    const body = [
      "What the Flux?",
      "[What the Flux? http://jaysoo.ca/2015/02/06/what-the-flux/]",
      "",
      "[flux] [ddd]",
    ].join("\n");

    const r = await note(body, "What the Flux?");

    expect(r.note.target.source).toBe(
      "http://jaysoo.ca/2015/02/06/what-the-flux/",
    );
    expect(r.note.body).toBeUndefined();
    expect(r.note.tags).toEqual(["flux", "ddd"]);
  });

  it("最初の引用を selector に入れ、コメントがあれば commenting にする", async () => {
    const body = [
      "題",
      "> DHHは LIQUID と書いていました。",
      "> Less Indirection",
      "",
      "> 2つ目の引用",
      "なるほど",
      "[題 https://example.com/a]",
    ].join("\n");

    const r = await note(body);

    expect(r.note.motivation).toBe("commenting");
    expect(r.note.target.selector).toEqual({
      type: "TextQuoteSelector",
      exact: "DHHは LIQUID と書いていました。\nLess Indirection",
    });
    expect(r.note.body?.value).toBe("> 2つ目の引用\nなるほど");
  });

  it("引用だけなら highlighting", async () => {
    const r = await note("題\n> 引用\n[題 https://example.com/a]");

    expect(r.note.motivation).toBe("highlighting");
    expect(r.note.body).toBeUndefined();
  });

  it("本文中の外部リンクは文字にして残す", async () => {
    const r = await note(
      "題\n[https://example.com/a]\n詳しくは [ここ https://example.com/b] を見る",
    );

    expect(r.note.target.source).toBe("https://example.com/a");
    expect(r.note.body?.value).toBe("詳しくは ここ を見る");
  });

  it("自サイトと画像のホストは出典にしない", async () => {
    const r = await note(
      "題\n[https://w.jgs.me/pages/x]\n[https://gyazo.com/abc]\n[元 https://example.com/c]",
    );

    expect(r.note.target.source).toBe("https://example.com/c");
  });

  it("文中の内部リンクは文字にするだけで tags にしない", async () => {
    const r = await note("題\n[https://example.com/a]\n[Core] の話 #memo");

    expect(r.note.body?.value).toBe("Core の話 #memo");
    expect(r.note.tags).toEqual(["memo"]);
  });

  it("他の Scrapbox project へのリンクは scrapbox.io の URL を出典にする", async () => {
    const r = await note("題\n[/yuta25/2022/8/12]\nおつかれさまでした");

    expect(r.note.target.source).toBe("https://scrapbox.io/yuta25/2022/8/12");
    expect(r.note.body?.value).toBe("おつかれさまでした");
  });

  it("出典が無ければ jgs.me の自分のページを target にする", async () => {
    const r = await note("君の名は\n[Core]\n感想", "君の名は");

    expect(r.note.target.source).toBe(
      "https://w.jgs.me/pages/%E5%90%9B%E3%81%AE%E5%90%8D%E3%81%AF",
    );
    expect(r.warnings).toEqual([
      "出典が無いので jgs.me のページを target にした",
    ]);
  });

  it("本文の 1 行目に題が繰り返されていたら落とす", async () => {
    const r = await note("題\n題\n[https://example.com/a]\n感想");

    expect(r.note.body?.value).toBe("感想");
  });

  it("sourceHash は Margin の HashURL と同じ値", async () => {
    const r = await note("題\n[https://w.example.com/pages/zet%3Ax/]");
    // sha256("w.example.com/pages/zet:x")
    expect(r.note.target.sourceHash).toBe(
      "f5263938fed64605c508e58289617cf9036c2f7a53f8db5639046ef7242c6ab6",
    );
  });

  it("タグは 10 個まで", async () => {
    const tags = Array.from({ length: TAGS_GIVEN }, (_, i) => `#t${i}`).join(
      " ",
    );
    const r = await note(`題\n[https://example.com/a]\n${tags}`);

    expect(r.note.tags).toHaveLength(TAGS_MAX);
    expect(r.warnings).toContain("タグを間引いた");
  });
});

describe("normalizeForHash", () => {
  it("www と末尾の / と scheme を落とし、query は残す", () => {
    expect(normalizeForHash("https://WWW.Example.com/a/?q=1")).toBe(
      "example.com/a/?q=1",
    );
    expect(normalizeForHash("http://example.com/a/")).toBe("example.com/a");
  });
});

describe("toIsoDatetime", () => {
  it("D1 の形式を UTC として読む", () => {
    expect(toIsoDatetime("2019-12-09 01:02:03")).toBe(
      "2019-12-09T01:02:03.000Z",
    );
  });
});
