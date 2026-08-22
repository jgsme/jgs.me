import { MAX_REDIRECTS, guardURL } from "./urlguard";

// Link: <https://ex.com/wm>; rel="webmention"
// rel は空白区切りで複数値を持ちうる。"webmentions" のような別の語と混同しない。
export function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;

  for (const part of header.split(/,(?=\s*<)/)) {
    const m = part.match(/<([^>]*)>\s*;\s*(.*)/);
    if (!m) continue;
    const href = m[1]!;
    const params = m[2]!;
    const rel = params.match(/rel\s*=\s*"?([^";]+)"?/i)?.[1];
    if (!rel) continue;
    if (rel.split(/\s+/).includes("webmention")) return href;
  }
  return null;
}

// 仕様が定める優先順位:
//   HTTP Link ヘッダ → <link rel="webmention"> → <a rel="webmention">
// 最初に見つかったものを使う。
export async function discoverEndpoint(target: string): Promise<string | null> {
  let current = target;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = guardURL(current);
    if (!guard.ok) return null;

    const res = await fetch(guard.url.href, {
      redirect: "manual",
      headers: { Accept: "text/html, */*;q=0.5" },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) return null;
      current = new URL(loc, guard.url).href;
      continue;
    }

    if (!res.ok) return null;

    // 1. Link ヘッダが最優先。HTML を読まずに決まる。
    const fromHeader = parseLinkHeader(res.headers.get("Link"));
    if (fromHeader !== null) {
      return new URL(fromHeader, guard.url).href;
    }

    // 2. HTML の link / a を先頭から探す。
    let found: string | null = null;
    await new HTMLRewriter()
      .on("link, a", {
        element(el) {
          if (found !== null) return;
          const rel = el.getAttribute("rel");
          if (!rel || !rel.split(/\s+/).includes("webmention")) return;
          found = el.getAttribute("href") ?? "";
        },
      })
      .transform(res)
      .text();

    return found === null ? null : new URL(found, guard.url).href;
  }

  return null;
}
