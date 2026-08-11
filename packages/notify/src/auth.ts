const BEARER = "Bearer ";

// 長さが一致する場合に内容で早期 return しない比較。長さ自体は漏れるので
// 完全な対策ではない。実効的な防御は十分に長いランダムなトークンを使うこと。
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// secret が未設定なら誰も通さない。設定漏れが「全員通過」に化けるのを防ぐ。
export function isAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!header?.startsWith(BEARER)) return false;

  return timingSafeEqual(header.slice(BEARER.length), secret);
}
