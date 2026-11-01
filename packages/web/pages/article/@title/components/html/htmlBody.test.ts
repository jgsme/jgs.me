import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HtmlBody } from "./HtmlBody";
import { SpoilerGate } from "../SpoilerGate";

describe("HtmlBody", () => {
  it("組み直しの body をそのまま描く", () => {
    const html = renderToString(
      createElement(HtmlBody, {
        body: '<div class="jgs-html-article" lang="ja"><h1 id="top">題</h1><script>init()</script></div>',
      }),
    );
    expect(html).toBe(
      '<div class="html-article-host"><div class="jgs-html-article" lang="ja"><h1 id="top">題</h1><script>init()</script></div></div>',
    );
  });

  it("ネタバレの入れ物は hidden の中に描き、表示するボタンを出す", () => {
    const html = renderToString(
      createElement(SpoilerGate, {
        spoiler: true,
        children: createElement(HtmlBody, {
          body: '<div class="jgs-html-article">x</div>',
        }),
      }),
    );
    // 入れ物が hidden の div より後ろにあること。
    // 通る: '<div hidden="" class="space-y-1"><div class="html-article-host"><div class="jgs-html-article">'
    // 落ちる: '<div class="space-y-1"><div class="jgs-html-article">' (hidden が無い)
    expect(html).toMatch(/<div hidden=""[^>]*>.*jgs-html-article/s);
    expect(html).toContain("表示する");
  });
});
