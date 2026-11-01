import { describe, expect, it } from "vitest";
import { firstHttpsImage, renderHtmlArticle } from "./htmlRender";

const doc = `<!doctype html><html lang="ja" class="dark"><head>
<meta charset="utf-8"><meta name="description" content="x">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" crossorigin="anonymous">
<style>:root{--a:1}body{margin:0}</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
</head><body class="p" style="background:#fff"><h1 id="top">題</h1><style media="print">h1{color:red}</style><script>init()</script></body></html>`;

describe("renderHtmlArticle", () => {
  it("link を head に出す", () => {
    expect(renderHtmlArticle(doc, { colorScheme: null }).head.links).toEqual([
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter",
        crossOrigin: "anonymous",
      },
    ]);
  });

  it("style は閉じ込めて head に、body からは消す", () => {
    const r = renderHtmlArticle(doc, { colorScheme: null });
    expect(r.head.styles).toEqual([
      {
        css: ".jgs-html-article{--a:1}.jgs-html-article{margin:0}",
        media: null,
      },
      { css: ".jgs-html-article h1{color:red}", media: "print" },
    ]);
    expect(r.body).not.toContain("<style");
  });

  it("入れ物に lang / class / style を移し、head の script を body の先頭に回す", () => {
    expect(renderHtmlArticle(doc, { colorScheme: "light dark" }).body).toBe(
      '<div class="jgs-html-article dark p" lang="ja" style="color-scheme: light dark;background:#fff">' +
        '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>' +
        '<h1 id="top">題</h1><script>init()</script></div>',
    );
  });

  it("meta や title は捨てる", () => {
    const r = renderHtmlArticle(doc, { colorScheme: null });
    expect(r.body).not.toContain("<meta");
  });

  it("html と body の style は html → body の順で繋ぐ", () => {
    const r = renderHtmlArticle(
      '<html style="color:red;"><body style="margin:0"><p>x</p></body></html>',
      { colorScheme: null },
    );
    expect(r.body).toBe(
      '<div class="jgs-html-article" style="color:red;margin:0"><p>x</p></div>',
    );
  });

  it("属性値はエスケープする", () => {
    const r = renderHtmlArticle(
      '<html lang="a&quot;b"><body><p>x</p></body></html>',
      {
        colorScheme: null,
      },
    );
    expect(r.body).toContain('lang="a&quot;b"');
  });

  it("断片も入れ物に包む", () => {
    expect(renderHtmlArticle("<p>x</p>", { colorScheme: null }).body).toBe(
      '<div class="jgs-html-article"><p>x</p></div>',
    );
  });

  it("version を持つ", () => {
    expect(renderHtmlArticle("<p>x</p>", { colorScheme: null }).version).toBe(
      1,
    );
  });
});

describe("renderHtmlArticle の取りこぼし", () => {
  const r = (h: string) => renderHtmlArticle(h, { colorScheme: null });
  const wrap = (inner: string) =>
    `<div class="jgs-html-article">${inner}</div>`;

  it("</body> の後ろの script を body に入れる", () => {
    expect(
      r(
        "<!doctype html><html><head></head><body><p>x</p></body>\n<script>tail()</script>\n</html>",
      ).body,
    ).toBe(wrap("<p>x</p>\n<script>tail()</script>\n"));
  });

  it("</html> の後ろの内容も body に入れる", () => {
    expect(r("<html><body><p>x</p></body></html><p>late</p>").body).toBe(
      wrap("<p>x</p><p>late</p>"),
    );
  });

  it("head だけの断片で head script を二重にしない", () => {
    expect(
      r("<head><script>once()</script><title>T</title></head><p>x</p>").body,
    ).toBe(wrap("<script>once()</script><p>x</p>"));
  });

  it("head が無くても link を持ち上げ、他の meta / title は残す", () => {
    const x = r(
      '<!doctype html><meta charset=utf-8><title>T</title><link rel=stylesheet href="https://a.example/s.css"><p>x</p>',
    );
    expect(x.head.links).toEqual([
      { rel: "stylesheet", href: "https://a.example/s.css" },
    ]);
    expect(x.body).not.toContain("<link");
    expect(x.body).toContain("<title>T</title>");
  });

  it("noscript / template の中の style と link は持ち上げない", () => {
    const x = r(
      '<noscript><style>a{b:c}</style><link rel="stylesheet" href="https://a.example/n.css"></noscript><template><style>d{e:f}</style></template>',
    );
    expect(x.head).toEqual({ links: [], styles: [] });
    expect(x.body).toContain("<style>a{b:c}</style>");
    expect(x.body).toContain("<style>d{e:f}</style>");
  });

  it("dir を入れ物に移す (body が優先)", () => {
    expect(r('<html dir="rtl"><body><p>x</p></body></html>').body).toBe(
      '<div class="jgs-html-article" dir="rtl"><p>x</p></div>',
    );
    expect(
      r('<html dir="rtl"><body dir="ltr"><p>x</p></body></html>').body,
    ).toContain('dir="ltr"');
  });
});

describe("firstHttpsImage", () => {
  it("先頭の絶対 https の img", () => {
    expect(
      firstHttpsImage(
        '<img src="./a.png"><img src="data:image/png;base64,x"><img src="http://a.example/h.png"><img src="https://a.example/2.png">',
      ),
    ).toBe("https://a.example/2.png");
    expect(firstHttpsImage("<p>x</p>")).toBeNull();
  });
});

describe("style の </style 対策", () => {
  const r = (h: string) => renderHtmlArticle(h, { colorScheme: null });

  it("SVG の style に実体参照で入れた </style> を css に残さない", () => {
    const { styles } = r(
      "<svg><style>a{} &lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;</style></svg>",
    ).head;
    expect(styles.length).toBe(1);
    expect(styles[0].css).not.toMatch(/<\/style/i);
    expect(styles[0].css).toContain("a{}");
  });

  it("普通の top-level style は変わらない", () => {
    expect(r("<style>h1{color:red}</style><p>x</p>").head.styles[0].css).toBe(
      ".jgs-html-article h1{color:red}",
    );
  });
});
