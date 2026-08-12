// Discord が待ち時間を教えてくれなかった時に使う値。
export const RETRY_AFTER_FALLBACK_MS = 1000;

// 相手が壊れた値を返しても待ち続けないための頭打ち。
const MAX_RETRY_AFTER_MS = 60000;

function toMs(seconds: unknown): number | null {
  const value = typeof seconds === "string" ? Number(seconds) : seconds;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return Math.min(Math.max(value, 0) * 1000, MAX_RETRY_AFTER_MS);
}

// 429 の待ち時間を決める。Discord は body の retry_after (秒、小数あり) が
// 一番正確なのでそれを優先し、無ければ Retry-After ヘッダ (秒) を見る。
export function parseRetryAfterMs(
  body: unknown,
  header: string | null,
): number {
  const fromBody =
    typeof body === "object" && body !== null && "retry_after" in body
      ? toMs((body as { retry_after: unknown }).retry_after)
      : null;
  if (fromBody !== null) return fromBody;

  const fromHeader = header === null ? null : toMs(header);
  if (fromHeader !== null) return fromHeader;

  return RETRY_AFTER_FALLBACK_MS;
}
