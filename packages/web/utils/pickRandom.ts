/**
 * items から重複なく n 件選ぶ。元配列は壊さない。
 * rand を差し替えられるのはテストのため。
 */
export function pickRandom<T>(
  items: T[],
  n: number,
  rand: () => number = Math.random,
): T[] {
  const pool = [...items];
  const take = Math.min(n, pool.length);
  const out: T[] = [];
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rand() * pool.length);
    // rand() が 1 を返す実装でも範囲外にならないよう丸める
    const safe = Math.min(idx, pool.length - 1);
    out.push(pool[safe]!);
    pool.splice(safe, 1);
  }
  return out;
}
