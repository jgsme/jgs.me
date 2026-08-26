// Gyazo の URL は本文中に複数の形で現れる。scrapbox-parser を通すと
// image node にならない形 ([説明 https://gyazo.com/xxx]) を取りこぼすので、
// 抽出も置換もこの 1 本の正規表現で行う。片方だけが拾える形があると
// 棚卸しのレポートと差し替えの実結果がズレる。
//
// 拾う形:
//   https://gyazo.com/<32hex>
//   https://gyazo.com/<32hex>/raw
//   https://gyazo.com/<32hex>/thumb/1000
//   https://gyazo.com/<32hex>/max_size/800
//   https://i.gyazo.com/<32hex>.png
//
// (?![0-9a-f]) は 32 桁ぴったりで区切るため。これが無いと、後ろに hex が
// 続く別物の URL を途中で切って別のハッシュとして拾ってしまう。
const GYAZO_URL_SOURCE =
  "https://(?:i\\.)?gyazo\\.com/([0-9a-f]{32})(?![0-9a-f])" +
  "(?:/(?:raw|thumb/\\d+|max_size/\\d+))?" +
  "(?:\\.(?:png|jpe?g|gif|webp|avif))?";

// g 付きの RegExp は lastIndex を持つ。使い回すと 2 回目の呼び出しが
// 途中から走って壊れるので、呼ぶたびに作る。
function gyazoPattern(): RegExp {
  return new RegExp(GYAZO_URL_SOURCE, "gi");
}

// 本文中の Gyazo URL を <32hex> に正規化し、重複を潰して返す。
export function extractGyazoHashes(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(gyazoPattern())) {
    seen.add(m[1]!.toLowerCase());
  }
  return [...seen];
}

// resolve が null を返したハッシュ (対応表に無い = 取り込めなかった) の URL は
// 元のまま残す。壊れたリンクを勝手に書き換えたり消したりしない。
export function replaceGyazoURLs(
  text: string,
  resolve: (hash: string) => string | null,
): { text: string; replaced: number; skipped: number } {
  let replaced = 0;
  let skipped = 0;
  const next = text.replace(gyazoPattern(), (match, hash: string) => {
    const url = resolve(hash.toLowerCase());
    if (url === null) {
      skipped++;
      return match;
    }
    replaced++;
    return url;
  });
  return { text: next, replaced, skipped };
}

// Scrapbox 自前のファイルも同じ外部依存の地雷を踏んでいる。今回は移行しないが、
// 次の判断のために件数だけ数える。
export function countScrapboxFiles(text: string): number {
  return [...text.matchAll(/https:\/\/scrapbox\.io\/files\/[0-9a-f]+/gi)].length;
}

// 取得元は /raw に固定する。拡張子が分からなくても Content-Type が返るため。
export function gyazoRawURL(hash: string): string {
  return `https://gyazo.com/${hash}/raw`;
}
