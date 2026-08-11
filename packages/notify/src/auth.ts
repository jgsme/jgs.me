const BEARER = "Bearer ";

// 長さが同じ場合に早期 return しない比較。ネットワーク越しのタイミング攻撃は
// 現実的ではないが、秘密の突き合わせを一定時間にしておくコストはほぼゼロ。
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
