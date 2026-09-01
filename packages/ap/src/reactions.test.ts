import { describe, expect, it } from "vitest";
import {
  kindOf,
  pageIDFromObjectURI,
  reactionIDOf,
  sourceURLOf,
  targetURIOf,
} from "./reactions";

const SITE = "https://w.jgs.me";

describe("pageIDFromObjectURI", () => {
  it("/o/<n> から page.id を取り出す", () => {
    expect(pageIDFromObjectURI("https://w.jgs.me/o/1234", SITE)).toBe(1234);
  });

  it("末尾スラッシュがあっても取れる", () => {
    expect(pageIDFromObjectURI("https://w.jgs.me/o/1234/", SITE)).toBe(1234);
  });

  it("フラグメント付きでも取れる", () => {
    expect(pageIDFromObjectURI("https://w.jgs.me/o/1234#create", SITE)).toBe(
      1234,
    );
  });

  it("別ドメインは null", () => {
    expect(pageIDFromObjectURI("https://evil.example/o/1234", SITE)).toBeNull();
  });

  it("/o/ 以外のパスは null", () => {
    expect(pageIDFromObjectURI("https://w.jgs.me/pages/foo", SITE)).toBeNull();
  });

  it("数値でなければ null", () => {
    expect(pageIDFromObjectURI("https://w.jgs.me/o/abc", SITE)).toBeNull();
  });

  it("URL でなければ null", () => {
    expect(pageIDFromObjectURI("not a url", SITE)).toBeNull();
  });
});

describe("kindOf", () => {
  it("Like は like", () => {
    expect(kindOf({ type: "Like" })).toBe("like");
  });

  it("EmojiReact は emoji (Misskey のリアクション)", () => {
    expect(kindOf({ type: "EmojiReact" })).toBe("emoji");
  });

  it("Announce は announce", () => {
    expect(kindOf({ type: "Announce" })).toBe("announce");
  });

  it("inReplyTo を持つ Create は reply", () => {
    expect(
      kindOf({ type: "Create", object: { inReplyTo: "https://w.jgs.me/o/1" } }),
    ).toBe("reply");
  });

  it("inReplyTo を持たない Create は null (他人の投稿は扱わない)", () => {
    expect(kindOf({ type: "Create", object: { content: "x" } })).toBeNull();
  });

  it("未対応の type は null", () => {
    expect(kindOf({ type: "Follow" })).toBeNull();
  });
});

describe("targetURIOf", () => {
  it("Like の object が文字列ならそれ", () => {
    expect(targetURIOf({ type: "Like", object: "https://w.jgs.me/o/1" })).toBe(
      "https://w.jgs.me/o/1",
    );
  });

  it("Like の object がオブジェクトなら id", () => {
    expect(
      targetURIOf({ type: "Like", object: { id: "https://w.jgs.me/o/1" } }),
    ).toBe("https://w.jgs.me/o/1");
  });

  it("Create は object.inReplyTo", () => {
    expect(
      targetURIOf({
        type: "Create",
        object: { inReplyTo: "https://w.jgs.me/o/2" },
      }),
    ).toBe("https://w.jgs.me/o/2");
  });

  it("object が無ければ null", () => {
    expect(targetURIOf({ type: "Like" })).toBeNull();
  });
});

describe("reactionIDOf", () => {
  it("Like は activity の id をそのまま使う (重複を防ぐ)", () => {
    expect(
      reactionIDOf({ type: "Like", id: "https://m.example/likes/1" }),
    ).toBe("https://m.example/likes/1");
  });

  // Delete が指してくるのは Note の id であって Create activity の id ではない。
  // ここで activity の id を使うと、相手が返信を消しても消せなくなる。
  it("Create は object.id (Note の id) を使う", () => {
    expect(
      reactionIDOf({
        type: "Create",
        id: "https://m.example/users/x/statuses/1/activity",
        object: { id: "https://m.example/users/x/statuses/1" },
      }),
    ).toBe("https://m.example/users/x/statuses/1");
  });

  it("Create で object.id が無ければ null", () => {
    expect(
      reactionIDOf({ type: "Create", id: "https://m.example/a", object: {} }),
    ).toBeNull();
  });

  it("id が無ければ null", () => {
    expect(reactionIDOf({})).toBeNull();
  });
});

// Create(返信) の主キーは Note の id で、Mastodon などではそのまま開ける
// permalink になっている。カードのリンク先に使うため source_url にも入れる。
describe("sourceURLOf", () => {
  it("reply は id をそのまま返す", () => {
    expect(
      sourceURLOf("reply", "https://mstdn.jp/users/jgs/statuses/117196086787"),
    ).toBe("https://mstdn.jp/users/jgs/statuses/117196086787");
  });

  // Like / Announce の主キーは activity の id。Mastodon だと
  // ".../statuses/1#likes/1" のような開けない URI が来るので使わない。
  it("reply 以外は null", () => {
    expect(
      sourceURLOf("like", "https://mstdn.jp/users/jgs#likes/1"),
    ).toBeNull();
    expect(sourceURLOf("announce", "https://m.example/a")).toBeNull();
    expect(sourceURLOf("emoji", "https://m.example/a")).toBeNull();
  });

  // AS2 の id は IRI であって http とは限らない。開けないものは入れない。
  it("http(s) でない id は null", () => {
    expect(sourceURLOf("reply", "tag:example.com,2026:1")).toBeNull();
    expect(sourceURLOf("reply", "urn:uuid:abc")).toBeNull();
  });

  it("id が無ければ null", () => {
    expect(sourceURLOf("reply", null)).toBeNull();
  });
});
