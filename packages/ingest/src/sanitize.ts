// Mastodon v4.2 が content で通す要素に揃える。
// ActivityPub で配信した時点でこれ以外は削られるため、
// 保存側で先に落としておけば自サイトの表示と配信内容が一致する。
// 見出しは Mastodon 側で p+strong に変換されるが、自サイトでは意味を保つので残す。
export const ALLOWED_TAGS = [
  "p", "span", "br", "a", "del", "pre", "code",
  "em", "strong", "b", "i", "u", "ul", "ol", "li", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "img", "figure", "figcaption",
] as const;

// 非許可タグは原則「タグだけ外して中身のテキストは残す」が、
// ここに挙げたものは中身ごと落とす。中身がテキストではなくコード
// (JS / CSS / 別マークアップ言語) であり、剥き出しにすると
// ページに意味不明な文字列が流れ込むため。
export const DROP_WITH_CONTENT = [
  "script", "style", "iframe", "object", "embed",
  "svg", "math", "template", "noscript",
] as const;

// style と on* は一切許さない。
export const ALLOWED_ATTRS: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
};

const SAFE_SCHEMES = ["http:", "https:"];

function isSafeUrl(value: string): boolean {
  try {
    return SAFE_SCHEMES.includes(new URL(value).protocol);
  } catch {
    // ここに来るのはスキーム無しの相対 URL だけ。
    // javascript: や data: は URL としてパースに成功するので上の分岐で落ちる。
    return true;
  }
}

// 正規表現ではなく HTMLRewriter (lol-html) を使う。
// 壊れたマークアップや属性値に埋め込まれた > で破綻しないため。
// この結果が R2 に保存され、表示時に dangerouslySetInnerHTML へ渡る。
export async function sanitizeHtml(html: string): Promise<string> {
  const allowed = new Set<string>(ALLOWED_TAGS);
  const dropped = new Set<string>(DROP_WITH_CONTENT);

  // ハンドラは "*" の 1 本だけにする。同じ要素に複数のハンドラを付けて
  // removeAndKeepContent() と remove() を両方指示すると、
  // どちらが勝つかが lol-html の実装依存になるため。
  const rewriter = new HTMLRewriter().on("*", {
    element(el) {
      if (!allowed.has(el.tagName)) {
        if (dropped.has(el.tagName)) {
          el.remove();
        } else {
          el.removeAndKeepContent();
        }
        return;
      }
      const keep = ALLOWED_ATTRS[el.tagName] ?? [];
      for (const [name, value] of [...el.attributes]) {
        if (!keep.includes(name)) {
          el.removeAttribute(name);
          continue;
        }
        if ((name === "href" || name === "src") && !isSafeUrl(value)) {
          el.removeAttribute(name);
        }
      }
    },
  });

  return await rewriter.transform(new Response(html)).text();
}
