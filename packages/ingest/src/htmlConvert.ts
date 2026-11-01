// HTML article の派生テキスト (検索用の素のテキストと md) を Workers AI の
// toMarkdown で作る glue。aiHtmlConverter は mf2extract.ts の HTMLRewriter と
// 同じく外部ランタイム依存なのでテストしない。

/** CRLF を LF にし、前後の空行を落とす */
export function normalizeDerivedText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

export type HtmlConverter = {
  toText: (html: string) => Promise<string>;
  toMarkdown: (html: string) => Promise<string>;
};

// インストール済みの @cloudflare/workers-types は conversionOptions.output も
// format: "text" も型に持たない (機能自体は 2026-07 の changelog で追加済み)。
// 型が追いつくまでここだけ広げる。
type ConversionOptionsWithOutput = ConversionOptions & {
  output?: { format?: "markdown" | "text" };
};

export function aiHtmlConverter(ai: Ai): HtmlConverter {
  const convert = async (html: string, format?: "text"): Promise<string> => {
    const conversionOptions: ConversionOptionsWithOutput = {
      html: { cssSelector: "body" },
      ...(format ? { output: { format } } : {}),
    };
    const r = await ai.toMarkdown(
      { name: "page.html", blob: new Blob([html], { type: "text/html" }) },
      { conversionOptions },
    );
    if (r.format === "error") throw new Error(r.error);
    return r.data;
  };
  return {
    toText: (html) => convert(html, "text"),
    toMarkdown: (html) => convert(html),
  };
}
