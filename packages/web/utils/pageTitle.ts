// /pages/@title の title は routeParams から取ってはいけない。
// client-side navigation で vike が投げる `.pageContext.json` リクエストでは、
// vike が pathname を 1 回余計にデコードしてから経路解決する
// (handlePageContextRequestUrl → modifyUrl が pathnameOriginal ではなく
//  decode 済みの pathname から URL を組み直している)。
// その結果 "%23" / "%3F" が本物の "#" / "?" になって hash / search として
// 切り落とされ、"#" や "?" を含む title のページがクリック遷移だけ
// not found になる (リロードは素の URL を 1 回だけデコードするので通る)。
// pageContext.urlOriginal は素のリクエスト URL のままなので、そこから取る。
const PAGE_CONTEXT_SUFFIX = "/index.pageContext.json";

// new URL() は非 ASCII をパーセントエンコードしてしまい、生の "%" を含む
// 手打ち URL を壊す。エンコードされたままの pathname が欲しいので自前で切る。
const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i;

export function pageTitleFromUrl(urlOriginal: string): string {
  const pathname = urlOriginal
    .split("#")[0]
    .split("?")[0]
    .replace(ORIGIN, "");
  const stripped = stripPageContextSuffix(pathname);
  const raw = stripped.slice(stripped.lastIndexOf("/") + 1);
  return decodeSafe(raw);
}

function stripPageContextSuffix(pathname: string): string {
  if (!pathname.endsWith(PAGE_CONTEXT_SUFFIX)) return pathname;
  const rest = pathname.slice(0, -PAGE_CONTEXT_SUFFIX.length);
  // "/pages/index.pageContext.json" は title が
  // "index.pageContext.json" のページ。ここで削ると title が消える。
  if (rest.indexOf("/", 1) === -1) return pathname;
  return rest;
}

// href は encodeURIComponent 済みなので通常は必ずデコードできる。
// 手打ちの URL などで生の "%" が来た時だけそのまま返す。
function decodeSafe(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
