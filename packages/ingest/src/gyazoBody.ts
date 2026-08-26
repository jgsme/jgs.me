import { bodyFormatOf } from "@jigsaw/db/body-key";
import { replaceGyazoURLs } from "./gyazo";

// Scrapbox アーカイブの JSON。lines[].text 以外に id / created / userId 等が
// 入っているが、こちらは中身を知らなくていい。JSON.parse → stringify の
// 往復でそのまま残るので、未知のフィールドは index signature で受けておく。
type ScrapboxArchive = {
  lines: { text: string }[];
  [key: string]: unknown;
};

// 走査用。R2 の生の中身から本文テキストだけ取り出す。
export function bodyTextOf(bodyKey: string, raw: string): string {
  if (bodyFormatOf(bodyKey) === "micropub-sb") return raw;
  const data = JSON.parse(raw) as ScrapboxArchive;
  return data.lines.map((l) => l.text).join("\n");
}

// 差し替え用。R2 に put し直す生の中身を返す。
// .json は行オブジェクトを丸ごと持ったまま text だけ書き換える。
// 本文テキストに落として組み直すと、行の id や userId が消える。
export function rewriteBody(
  bodyKey: string,
  raw: string,
  resolve: (hash: string) => string | null,
): { raw: string; replaced: number; skipped: number } {
  if (bodyFormatOf(bodyKey) === "micropub-sb") {
    const r = replaceGyazoURLs(raw, resolve);
    return { raw: r.text, replaced: r.replaced, skipped: r.skipped };
  }

  const data = JSON.parse(raw) as ScrapboxArchive;
  let replaced = 0;
  let skipped = 0;
  for (const line of data.lines) {
    const r = replaceGyazoURLs(line.text, resolve);
    line.text = r.text;
    replaced += r.replaced;
    skipped += r.skipped;
  }
  return { raw: JSON.stringify(data), replaced, skipped };
}

// 書き戻すときの Content-Type。入れ物が違うので揃えない。
export function bodyContentType(bodyKey: string): string {
  return bodyFormatOf(bodyKey) === "micropub-sb"
    ? "text/plain; charset=utf-8"
    : "application/json";
}
