import { describe, expect, it } from "vitest";
import { articleHeading } from "./heading";

describe("articleHeading", () => {
  it("zet でなければ page.title をそのまま見出しと p-name にする", () => {
    expect(
      articleHeading({ title: "記事", zetTitle: null, zetDate: null }),
    ).toEqual({ heading: "記事", isName: true });
  });

  // page.title (zet:<rkey>) は内部キー。見出しにも <title> にも出さない。
  it("題のある zet は zet.title を見出しと p-name にする", () => {
    expect(
      articleHeading({
        title: "zet:3m2abcdefghij",
        zetTitle: "朝の散歩",
        zetDate: "2026-10-11",
      }),
    ).toEqual({ heading: "朝の散歩", isName: true });
  });

  // 日付だけの見出しは題ではないので p-name にしない。
  it("題の無い zet は日付を見出しにし、p-name にしない", () => {
    expect(
      articleHeading({
        title: "zet:3m2abcdefghij",
        zetTitle: null,
        zetDate: "2026-10-11",
      }),
    ).toEqual({ heading: "2026-10-11", isName: false });
  });

  it("題が空白だけの zet も題の無い zet と同じ", () => {
    expect(
      articleHeading({
        title: "zet:3m2abcdefghij",
        zetTitle: "  ",
        zetDate: "2026-10-11",
      }),
    ).toEqual({ heading: "2026-10-11", isName: false });
  });
});
