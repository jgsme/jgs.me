// HTML article のヘッダの演出 (E4 上書き) の、DOM に依存しない部品。
// 試作 (artifact「HTML 記事の器」) の rng / GLYPHS / glitchMark / CH を写したもの。
// 崩れ方は題から作った乱数で決めるので、同じ記事なら毎回同じ姿になる。
// 乱数を引く順や式を変えると、既に公開した記事の崩れ方が変わる。

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const XORSHIFT = { a: 13, b: 17, c: 5 } as const;
// 0〜1 を 1 万段に刻む
const RNG_STEPS = 10000;

// FNV-1a で種を作り、xorshift で回す。
export const rng = (seed: string): (() => number) => {
  // 試作と同じく UTF-16 の単位で回す (Array.from(seed) だとサロゲートペアが 1 つになる)
  let h = Array.from({ length: seed.length }, (_, i) =>
    seed.charCodeAt(i),
  ).reduce((acc, code) => Math.imul(acc ^ code, FNV_PRIME), FNV_OFFSET);
  return () => {
    h ^= h << XORSHIFT.a;
    h ^= h >>> XORSHIFT.b;
    h ^= h << XORSHIFT.c;
    return ((h >>> 0) % RNG_STEPS) / RNG_STEPS;
  };
};

// マークの 4 つのグリフ (mark.svg の図形)。1 つずつずらして描く。
export const GLYPHS: readonly {
  tag: "path" | "polyline" | "polygon";
  attrs: Record<string, string>;
}[] = [
  {
    tag: "path",
    attrs: {
      d: "M50.61,40.08H87.34L75.63,50.85l-.11,48-10.4,9.91,0-33.23-15.57,0L49.5,98.85l-10.68,9.91v-58M49.58,64.8l15.57,0v-14H49.58Z",
    },
  },
  {
    tag: "polyline",
    attrs: {
      points:
        "9.49 15.33 0 0 58.42 21.78 115.17 0 105.32 15.33 67.84 28.21 113.21 28.3 103.13 39.05 0.38 38.97 9.03 28.15 48.54 27.49",
    },
  },
  {
    tag: "polyline",
    attrs: {
      points:
        "100.58 76.31 76.65 76.31 76.65 51.53 89.12 40.08 89.12 65.6 104.04 65.6 104.41 39.55 115.17 28.3 115.17 75.75 80.92 108.76 66.82 108.76",
    },
  },
  {
    tag: "polygon",
    attrs: {
      points:
        "17.71 98.85 17.71 50.84 9.03 50.84 0.38 40.08 48.54 40.08 37.19 50.84 28.42 50.84 28.42 108.76 17.71 98.85",
    },
  },
];

// rx / ry は止まった姿のずれ、jx は試作の揺れの振れ幅 (今は描かないが、
// 乱数の列を試作と揃えるために引いて持っておく)。
// 切るグリフは自分では描かず (jx は null)、split の上下 2 つに分けて描く。
export type GlitchGlyph = {
  rx: number;
  ry: number;
  jx: number | null;
  shadow: null | { color: "cyan" | "pink"; rx: number; jx: number };
  split: null | { d: number; jxTop: number; jxBottom: number };
};
export type GlitchMark = { split: number; cut: number; glyphs: GlitchGlyph[] };

// 試作の glitchMark の係数。ずれは amp 倍する (jx と cut は amp に依らない)。
// 掛ける順も試作と同じにする (浮動小数の丸めで toFixed(1) の結果が変わりうる)。
const MARK = {
  cutMin: 35,
  cutRange: 40,
  jxRange: 30,
  rxRange: 10,
  ryRange: 4,
  shadowOffset: 3,
  splitMin: 4,
  splitRange: 6,
} as const;
const HALF = 0.5;

// 試作は toFixed(1) した文字列を SVG に書いていた。同じ数になるように丸める。
// + 0 は -0 を 0 に揃えるため。
const round1 = (x: number): number => Number(x.toFixed(1)) + 0;

// 試作の glitchMark が引く順: split → cut → グリフごとに rx → ry → 影の有無
// (→ 影の色 → 影の jx) → 切るなら d → 上の jx → 下の jx、切らないなら jx。
export const glitchMarkParams = (seed: string, amp: number): GlitchMark => {
  const r = rng(seed + "mark");
  const split = Math.floor(r() * GLYPHS.length);
  const cut = round1(MARK.cutMin + r() * MARK.cutRange);
  const centered = (range: number) => (r() - HALF) * range;
  const jx = () => round1(centered(MARK.jxRange));
  const glyphs = GLYPHS.map((_, i): GlitchGlyph => {
    const rx = round1(centered(MARK.rxRange) * amp);
    const ry = round1(centered(MARK.ryRange) * amp);
    let shadow: GlitchGlyph["shadow"] = null;
    if (r() < HALF) {
      const color = r() < HALF ? "cyan" : "pink";
      const offset = color === "cyan" ? -MARK.shadowOffset : MARK.shadowOffset;
      shadow = { color, rx: round1(rx + offset), jx: jx() };
    }
    if (i === split) {
      const d = round1((MARK.splitMin + r() * MARK.splitRange) * amp);
      const jxTop = jx();
      const jxBottom = jx();
      return { rx, ry, jx: null, shadow, split: { d, jxTop, jxBottom } };
    }
    return { rx, ry, jx: jx(), shadow, split: null };
  });
  return { split, cut, glyphs };
};

// 刷り直しに使う字。試作の CH。
export const OVERWRITE_CHARS =
  "01#$%&*+=<>/\\|{}[]?!:;~^ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ";
