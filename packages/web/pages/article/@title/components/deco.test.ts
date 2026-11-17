import { describe, expect, it } from "vitest";
import { decoClassName, decoLevel } from "./deco";

describe("decoLevel", () => {
  it("* の段を数で返す", () => {
    expect(decoLevel(["*-1"])).toBe(1);
    expect(decoLevel(["/", "*-10"])).toBe(10);
  });
  it("* が無ければ null", () => {
    expect(decoLevel(["/", "-"])).toBeNull();
    expect(decoLevel([])).toBeNull();
  });
});

describe("decoClassName", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("%i 段目", (n) => {
    expect(decoClassName(n)).toBe(
      `text-deco-${n}-mobile md:text-deco-${n} wrap-anywhere`,
    );
  });
  it("範囲の外は空", () => {
    expect(decoClassName(0)).toBe("");
    expect(decoClassName(11)).toBe("");
  });
});
