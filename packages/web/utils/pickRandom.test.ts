import { describe, expect, it } from "vitest";
import { pickRandom } from "./pickRandom";

// 決まった順で値を返す疑似乱数
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("pickRandom", () => {
  it("指定件数を返す", () => {
    expect(pickRandom([1, 2, 3, 4, 5], 3, seq([0, 0, 0]))).toHaveLength(3);
  });

  it("候補が少なければあるだけ返す", () => {
    expect(pickRandom([1, 2], 5, seq([0, 0]))).toHaveLength(2);
  });

  it("空なら空", () => {
    expect(pickRandom([], 5)).toEqual([]);
  });

  it("同じ要素を二度返さない", () => {
    const out = pickRandom([1, 2, 3, 4, 5], 5, seq([0.9, 0.9, 0.9, 0.9, 0.9]));
    expect(new Set(out).size).toBe(5);
  });

  it("元の配列を壊さない", () => {
    const src = [1, 2, 3];
    pickRandom(src, 2, seq([0, 0]));
    expect(src).toEqual([1, 2, 3]);
  });
});
