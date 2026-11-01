import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// cascade 自体は node で確かめられないので、ファイルの中身を読んで固定する。
// ブラウザでの確認は Task 15 のチェックリストで行う。
describe("html-article.css", () => {
  it("preflight の打ち消しは base layer の revert-layer", () => {
    const css = readFileSync(
      new URL("./html-article.css", import.meta.url),
      "utf8",
    );
    expect(css).toMatch(/@layer base\s*\{/);
    expect(css).toContain("all: revert-layer");
    expect(css).not.toMatch(/all:\s*revert;/);
  });

  it("index.css は laque の後で html-article.css を読む", () => {
    const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
    expect(css.indexOf('@import "./html-article.css"')).toBeGreaterThan(
      css.indexOf('@import "laque/theme.css"'),
    );
  });
});
