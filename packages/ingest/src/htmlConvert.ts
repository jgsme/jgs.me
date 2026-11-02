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

export function aiHtmlConverter(ai: Ai): HtmlConverter {
  const convert = async (html: string, format?: "text"): Promise<string> => {
    const conversionOptions: ConversionOptions = {
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
