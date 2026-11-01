import { expect, it } from "vitest";
import { glitchMarkParams, rng, type GlitchMark } from "./overwrite";

it("rng は同じ種なら同じ列、0 以上 1 未満", () => {
  const a = rng("部屋の CO2");
  const b = rng("部屋の CO2");
  const xs = [a(), a(), a()];
  expect([b(), b(), b()]).toEqual(xs);
  xs.forEach((x) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});

it("種が違えば違う列", () => {
  expect(rng("a")()).not.toBe(rng("b")());
});

it("glitchMarkParams は題で決まる", () => {
  expect(glitchMarkParams("部屋の CO2", 0.8)).toEqual(
    glitchMarkParams("部屋の CO2", 0.8),
  );
  expect(glitchMarkParams("部屋の CO2", 0.8)).not.toEqual(
    glitchMarkParams("寝室の照度ログ", 0.8),
  );
});

it("切るグリフは 1 つ、切る位置は 35〜75", () => {
  const m = glitchMarkParams("部屋の CO2", 0.8);
  expect(m.glyphs.filter((g) => g.split !== null)).toHaveLength(1);
  expect(m.glyphs[m.split]!.split).not.toBeNull();
  expect(m.cut).toBeGreaterThanOrEqual(35);
  expect(m.cut).toBeLessThan(75);
});

// 試作の rng / glitchMark を抜き出して node で
// glitchMark("部屋の CO2", "#d1392e", .8) を動かし、出てきた SVG の
// clipPath の y (cut) と各 <g> の --rx --ry --jx を写したもの。
// 切るグリフ (3) の rx は、影の rx (-1.3) に 3 を足して戻した値。
const EXPECTED_FROM_PROTOTYPE: GlitchMark = {
  split: 3,
  cut: 37.3,
  glyphs: [
    {
      rx: 0.2,
      ry: 0.9,
      jx: 5.5,
      shadow: { color: "cyan", rx: -2.8, jx: -11.7 },
      split: null,
    },
    { rx: -2, ry: 0.2, jx: 10.5, shadow: null, split: null },
    {
      rx: -2.4,
      ry: -1.3,
      jx: 2.5,
      shadow: { color: "cyan", rx: -5.4, jx: -12.1 },
      split: null,
    },
    {
      rx: 1.7,
      ry: 0.1,
      jx: null,
      shadow: { color: "cyan", rx: -1.3, jx: -2.4 },
      split: { d: 7.2, jxTop: 7.6, jxBottom: -13.6 },
    },
  ],
};

it("試作の glitchMark と同じ数を出す", () => {
  expect(glitchMarkParams("部屋の CO2", 0.8)).toEqual(EXPECTED_FROM_PROTOTYPE);
});
