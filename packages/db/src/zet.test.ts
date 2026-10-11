import { describe, expect, it } from "vitest";
import {
  ZET_COPY_PROTOCOL,
  pageDisplayTitle,
  zetDisplayTitle,
  zetPageTitle,
  zetPath,
} from "./zet";

const RKEY = "3m2abcdefghij";

describe("zetPageTitle", () => {
  it("内部用の題は zet:<rkey>", () => {
    expect(zetPageTitle(RKEY)).toBe(`zet:${RKEY}`);
  });
});

describe("zetPath", () => {
  it("/zets/<rkey> を返す", () => {
    expect(zetPath(RKEY)).toBe(`/zets/${RKEY}`);
  });

  it("rkey を percent encoding する", () => {
    expect(zetPath("a/b")).toBe("/zets/a%2Fb");
  });
});

describe("ZET_COPY_PROTOCOL", () => {
  // bsky 投稿の copy 行が "atproto" を使う。同じ (objectID, protocol) に
  // upsert されると zet の at-uri が bsky 投稿の at-uri で上書きされる。
  it("bsky 投稿の copy と衝突しない値", () => {
    expect(ZET_COPY_PROTOCOL).not.toBe("atproto");
  });
});

describe("zetDisplayTitle", () => {
  it("題があれば題", () => {
    expect(zetDisplayTitle({ title: "朝の散歩", date: "2026-10-11" })).toBe(
      "朝の散歩",
    );
  });

  it("題が無ければ日付", () => {
    expect(zetDisplayTitle({ title: null, date: "2026-10-11" })).toBe(
      "2026-10-11",
    );
  });

  it("空白だけの題は無いものとして日付", () => {
    expect(zetDisplayTitle({ title: "  ", date: "2026-10-11" })).toBe(
      "2026-10-11",
    );
  });
});

describe("pageDisplayTitle", () => {
  it("zet でない page は page.title", () => {
    expect(
      pageDisplayTitle({ title: "記事", zetTitle: null, zetDate: null }),
    ).toBe("記事");
  });

  it("zet の page は page.title (zet:<rkey>) を出さない", () => {
    expect(
      pageDisplayTitle({
        title: `zet:${RKEY}`,
        zetTitle: null,
        zetDate: "2026-10-11",
      }),
    ).toBe("2026-10-11");
  });

  it("zet に題があれば題", () => {
    expect(
      pageDisplayTitle({
        title: `zet:${RKEY}`,
        zetTitle: "朝の散歩",
        zetDate: "2026-10-11",
      }),
    ).toBe("朝の散歩");
  });
});
