import { describe, expect, it } from "vitest";
import { parse } from "@progfay/scrapbox-parser";
import { firstLinkHostname } from "./firstLinkHostname";

// parse() の既定は hasTitle: true なので、1 行目は題として扱われる。
// 本文に相当するのは 2 行目以降。
const blocksOf = (body: string) => parse(body);

describe("firstLinkHostname", () => {
  it("本文の絶対 URL リンクからホスト名を取る", () => {
    const blocks = blocksOf("題\n[https://example.com/a/b 元記事]");
    expect(firstLinkHostname(blocks)).toBe("example.com");
  });

  it("最初に出てきたリンクを使う", () => {
    const blocks = blocksOf(
      "題\n[https://first.example/a 一本目]\n[https://second.example/b 二本目]",
    );
    expect(firstLinkHostname(blocks)).toBe("first.example");
  });

  // Scrapbox 記法の [ページ名] は他ページへの相対リンク。外部記事ではない。
  it("相対リンクしか無ければ null", () => {
    const blocks = blocksOf("題\n[別のページ]");
    expect(firstLinkHostname(blocks)).toBeNull();
  });

  it("リンクが無ければ null", () => {
    const blocks = blocksOf("題\nただの本文");
    expect(firstLinkHostname(blocks)).toBeNull();
  });

  it("引用の中のリンクも拾う", () => {
    const blocks = blocksOf("題\n> [https://example.com/a 引用元]");
    expect(firstLinkHostname(blocks)).toBe("example.com");
  });

  it("装飾の中のリンクも拾う", () => {
    const blocks = blocksOf("題\n[* [https://example.com/a 強調リンク]]");
    expect(firstLinkHostname(blocks)).toBe("example.com");
  });

  it("www は落とさずそのまま返す", () => {
    const blocks = blocksOf("題\n[https://www.example.com/a 元記事]");
    expect(firstLinkHostname(blocks)).toBe("www.example.com");
  });

  // scrapbox-parser は `[https://[::1 broken]` のような壊れた URL も
  // pathType: "absolute" の link ノードとしてパースしてしまい、
  // href がそのまま new URL() で throw する形になる。1 本目が壊れていても
  // 後続行の正しいリンクを見逃さないことを確認する。
  it("壊れた URL の次の行に正しいリンクがあれば、正しい方のホスト名を返す", () => {
    const blocks = blocksOf(
      "題\n[https://[::1 broken]\n[https://good.example/a good]",
    );
    expect(firstLinkHostname(blocks)).toBe("good.example");
  });

  it("壊れた URL しか無ければ null", () => {
    const blocks = blocksOf("題\n[https://[::1 broken]");
    expect(firstLinkHostname(blocks)).toBeNull();
  });

  it("同じ行の中で壊れた URL の後に正しいリンクがあれば、正しい方のホスト名を返す", () => {
    const blocks = blocksOf(
      "題\n[https://[::1 broken] [https://good.example/a good]",
    );
    expect(firstLinkHostname(blocks)).toBe("good.example");
  });
});
