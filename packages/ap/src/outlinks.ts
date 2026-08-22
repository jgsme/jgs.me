import { guardURL } from "./urlguard";

// 本文 HTML から Webmention を送るべき外部リンクを取る。
// 自サイトへのリンクは対象外 (内部リンクは Webmention の意味を持たない)。
export async function extractOutlinks(
  html: string,
  siteUrl: string,
): Promise<string[]> {
  const own = new URL(siteUrl).origin;
  const found = new Set<string>();

  await new HTMLRewriter()
    .on("a", {
      element(el) {
        const href = el.getAttribute("href");
        if (!href) return;

        // nofollow が付いているリンクには送らない。
        // 引用や参照であって「言及」の意図が無いことを示すため。
        const rel = el.getAttribute("rel") ?? "";
        if (rel.split(/\s+/).includes("nofollow")) return;

        const guard = guardURL(href);
        if (!guard.ok) return;
        if (guard.url.origin === own) return;

        // フラグメントは送信先の同一性に影響しないので落とす。
        guard.url.hash = "";
        found.add(guard.url.href);
      },
    })
    .transform(new Response(html))
    .text();

  return [...found];
}
