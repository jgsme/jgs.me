// R2 に置く .sb は Scrapbox アーカイブ (.json) と同じく「1行目が題」。
// 読み側 (web の +data.ts / ap の scrapboxToHtml) は parse() を既定
// (hasTitle: true) で呼んで先頭ブロックを題として捨てるので、題を先頭に
// 置いておかないと本文の1行目が黙って消える。
export function buildSbBody(title: string, content: string): string {
  return `${title}\n${content}`;
}
