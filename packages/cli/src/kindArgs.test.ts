import { describe, expect, it } from "vitest";
import { CLIP_KINDS, parseKindArgs, parseKindCsv } from "./kindArgs.ts";

describe("parseKindArgs", () => {
  it("id と kind の 2 つで 1 件更新", () => {
    expect(parseKindArgs(["1613", "quote"])).toEqual({
      mode: "one",
      id: 1613,
      kind: "quote",
    });
  });

  it("URL でも id を取れる", () => {
    expect(parseKindArgs(["https://w.jgs.me/p/1613", "photo"])).toEqual({
      mode: "one",
      id: 1613,
      kind: "photo",
    });
  });

  it("--csv でファイルを受ける", () => {
    expect(parseKindArgs(["--csv", "draft.csv"])).toEqual({
      mode: "csv",
      path: "draft.csv",
    });
  });

  it("知らない kind は null", () => {
    expect(parseKindArgs(["1613", "bookmark"])).toBeNull();
  });

  it("引数が足りなければ null", () => {
    expect(parseKindArgs([])).toBeNull();
    expect(parseKindArgs(["1613"])).toBeNull();
    expect(parseKindArgs(["--csv"])).toBeNull();
  });

  it("id が正の整数でなければ null", () => {
    expect(parseKindArgs(["0", "quote"])).toBeNull();
    expect(parseKindArgs(["-1", "quote"])).toBeNull();
    expect(parseKindArgs(["abc", "quote"])).toBeNull();
  });

  it("CLIP_KINDS は link / quote / photo / video", () => {
    expect(CLIP_KINDS).toEqual(["link", "quote", "photo", "video"]);
  });
});

describe("parseKindCsv", () => {
  const head = "pageID,kind,quote,video,bodyimg,chars,multi,title";

  it("ヘッダを飛ばして pageID と kind を読む", () => {
    const out = parseKindCsv(
      `${head}\n1613,quote,1,0,0,42,0,題\n1612,link,0,0,0,10,0,別の題`,
    );
    expect(out.rows).toEqual([
      { id: 1613, kind: "quote" },
      { id: 1612, kind: "link" },
    ]);
    expect(out.errors).toEqual([]);
  });

  it("題にカンマが入っていても読める", () => {
    // title は最後の列なので、先頭 2 列だけ見れば split の数は問題にならない。
    const out = parseKindCsv(
      `${head}\n1613,quote,1,0,0,42,0,題に, カンマ, がある`,
    );
    expect(out.rows).toEqual([{ id: 1613, kind: "quote" }]);
  });

  it("空行は飛ばす", () => {
    const out = parseKindCsv(`${head}\n\n1613,quote,1,0,0,42,0,題\n\n`);
    expect(out.rows).toEqual([{ id: 1613, kind: "quote" }]);
    expect(out.errors).toEqual([]);
  });

  it("不正な行は errors に入れて、他の行は読む", () => {
    const out = parseKindCsv(
      `${head}\n1613,bookmark,0,0,0,1,0,題\nxxx,quote,0,0,0,1,0,題\n1612,link,0,0,0,1,0,題`,
    );
    expect(out.rows).toEqual([{ id: 1612, kind: "link" }]);
    expect(out.errors).toHaveLength(2);
  });

  it("同じ id が 2 回あれば後の行が勝つ", () => {
    const out = parseKindCsv(
      `${head}\n1613,quote,0,0,0,1,0,題\n1613,photo,0,0,0,1,0,題`,
    );
    expect(out.rows).toEqual([{ id: 1613, kind: "photo" }]);
  });
});
