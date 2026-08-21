// 比較用の正規形。スキーム / 末尾スラッシュ / フラグメント / ホストの大小 /
// デフォルトポートの差を吸収する。クエリは意味を持ちうるので残す。
//
// 厳密一致にすると、相手が http:// で書いていたり末尾スラッシュを付けていたり
// するだけで Webmention のリンク検証が落ちる。
function normalize(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const defaultPort = u.protocol === "https:" ? "443" : "80";
  const port = u.port === "" || u.port === defaultPort ? "" : `:${u.port}`;
  const path = u.pathname.replace(/\/+$/, "");

  return `${u.hostname.toLowerCase()}${port}${path}${u.search}`;
}

export function sameURL(a: string, b: string): boolean {
  const na = normalize(a);
  if (na === null) return false;
  return na === normalize(b);
}
