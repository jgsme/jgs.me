import { describe, expect, it } from "vitest";
import type { ReactionJSON } from "@/server/routes/reactions";
import { splitReactions } from "./reactionGroups";

function r(kind: string, id = kind): ReactionJSON {
  return {
    id,
    kind,
    emoji: null,
    actorName: null,
    actorURL: null,
    actorIcon: null,
    content: null,
    sourceURL: null,
    sourceTitle: null,
    sourceImage: null,
    created: "2026-09-01T00:00:00.000Z",
  };
}

describe("splitReactions", () => {
  // 「どこから来たか」が本体の反応だけカードにする。
  it("reply と mention をカードにする", () => {
    const { cards } = splitReactions([r("reply"), r("mention")]);
    expect(cards.map((x) => x.kind)).toEqual(["reply", "mention"]);
  });

  // like に題を出しても情報が増えない。アイコンの粒のまま並べる。
  it("like / emoji / announce は粒のまま", () => {
    const { glyphs } = splitReactions([r("like"), r("emoji"), r("announce")]);
    expect(glyphs.map((x) => x.kind)).toEqual(["like", "emoji", "announce"]);
  });

  it("カードと粒は互いに混ざらない", () => {
    const { cards, glyphs } = splitReactions([r("like"), r("reply")]);
    expect(cards.map((x) => x.kind)).toEqual(["reply"]);
    expect(glyphs.map((x) => x.kind)).toEqual(["like"]);
  });

  // kind が増えたときに落ちる先。カードは題か本文が要るので粒に寄せる。
  it("知らない kind は粒に寄せる", () => {
    const { cards, glyphs } = splitReactions([r("bookmark")]);
    expect(cards).toEqual([]);
    expect(glyphs.map((x) => x.kind)).toEqual(["bookmark"]);
  });

  it("順序を保つ", () => {
    const { cards } = splitReactions([r("reply", "a"), r("mention", "b")]);
    expect(cards.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
