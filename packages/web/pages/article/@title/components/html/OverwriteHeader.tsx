import React, { createElement, useEffect, useRef } from "react";
import { GLYPHS, OVERWRITE_CHARS, glitchMarkParams } from "./overwrite";

// HTML article のヘッダ (E4 上書き)。いつもの赤帯が端末の文字列で刷り直されて
// 闇に落ち、題の行は打ち直される。
//
// SSR は 0 秒の姿 (赤帯 + マーク、空の noise、見えない dk)。動きは effect の JS で
// 付け、reduce の時は CSS の media query で最初から闇の姿にする (JS を待たない)。
// 高さは赤帯と題の行で固定してあり、演出の前後で変わらない。
//
// noise の中身と題の文字は effect が DOM を直接書き換える。55ms ごとに React で
// 描き直すほどのものではなく、React はここの子を持たないので触り返さない。

// 試作の runOverwrite の時間割 (ms)。
const SCATTER_END = 1000; // 〜ここまで: ぽつぽつ刷り直す
const FLOOD_END = 1500; // 〜ここまで: 上の行から全部埋める。過ぎたら止める
const TICK = 55;
const LABEL_DARK_AT = 1050; // 題の行を闇に落とす
const TYPE_START = 1080; // 題を 1 文字ずつ打ち直す
const TYPE_STEP = 40;

// 文字のマス目。11px の等幅で 1 字ほぼ 6.6px、5 行で帯の 64px を埋める。
const CHAR_WIDTH = 6.6;
const ROWS = 5;
// 端で途切れないように少し余分に
const EXTRA_COLS = 2;

// 刷り直しの度合い。試作の値。
const SCATTER = {
  // 塊の数は経過の 2 乗で増える
  curve: 2,
  maxExtraRuns: 6,
  minLen: 2,
  extraLen: 10,
  reroll: 0.15,
} as const;
const FLOOD = {
  rowBias: 0.55,
  jitter: 0.45,
  reroll: 0.6,
  fresh: 0.3,
} as const;
const SETTLED_DENSITY = 0.05;

// 文字の状態ごとの span の class。未着、刷り直し済み、今刷り直した (明るく出す)。
const SPAN_CLASS = {
  blank: "jgs-e4-u",
  done: "jgs-e4-w",
  fresh: "jgs-e4-w jgs-e4-n",
} as const;
type CellKind = keyof typeof SPAN_CLASS;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const esc = (c: string) => ESCAPES[c] ?? c;
const randomChar = () =>
  OVERWRITE_CHARS[Math.floor(Math.random() * OVERWRITE_CHARS.length)]!;

type Parts = {
  root: HTMLElement;
  noise: HTMLElement;
  base: HTMLElement;
  dk: HTMLElement;
  label: HTMLElement;
  title: HTMLElement;
};

// 試作の runOverwrite。止める関数を返す。
function runOverwrite(p: Parts, title: string): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  const cols = Math.ceil(p.root.offsetWidth / CHAR_WIDTH) + EXTRA_COLS;
  const n = cols * ROWS;
  const st = new Uint8Array(n);
  const fresh = new Uint8Array(n);
  const ch: string[] = new Array(n).fill(" ");

  const kindOf = (i: number): CellKind => {
    if (!st[i]) return "blank";
    return fresh[i] ? "fresh" : "done";
  };
  // 1 行を、状態の同じ字が続く塊ごとに span で包む。
  const renderRow = (y: number): string =>
    Array.from({ length: cols }, (_, x) => y * cols + x)
      .reduce<{ kind: CellKind; text: string }[]>((runs, i) => {
        const kind = kindOf(i);
        const c = st[i] ? esc(ch[i]!) : " ";
        const last = runs[runs.length - 1];
        if (last && last.kind === kind) last.text += c;
        else runs.push({ kind, text: c });
        return runs;
      }, [])
      .map((run) => `<span class="${SPAN_CLASS[run.kind]}">${run.text}</span>`)
      .join("");
  const render = () => {
    p.noise.innerHTML = Array.from({ length: ROWS }, (_, y) =>
      renderRow(y),
    ).join("\n");
  };
  const hit = (i: number) => {
    st[i] = 1;
    ch[i] = randomChar();
    fresh[i] = 1;
  };
  const settle = () => {
    st.fill(1);
    fresh.fill(0);
    ch.forEach((_, i) => {
      ch[i] = Math.random() < SETTLED_DENSITY ? randomChar() : " ";
    });
    render();
    p.noise.classList.add("jgs-e4-full", "jgs-e4-settled");
    p.base.style.opacity = "0";
    p.dk.classList.add("jgs-e4-on");
  };
  const stop = () => timers.forEach(clearTimeout);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settle();
    p.label.classList.add("jgs-e4-dkl");
    return stop;
  }

  const start = performance.now();
  // 上の行ほど早く埋まる
  const thresh = Float32Array.from(
    { length: n },
    (_, i) =>
      (Math.floor(i / cols) / ROWS) * FLOOD.rowBias +
      Math.random() * FLOOD.jitter,
  );
  const tick = () => {
    const t = performance.now() - start;
    fresh.fill(0);
    if (t < SCATTER_END) {
      // ぽつぽつ: 数文字の塊を少しずつ。後半ほど数が増える。
      const runs = Math.floor(
        1 + (t / SCATTER_END) ** SCATTER.curve * SCATTER.maxExtraRuns,
      );
      Array.from({ length: runs }).forEach(() => {
        const y = Math.floor(Math.random() * ROWS);
        const x = Math.floor(Math.random() * cols);
        const len =
          SCATTER.minLen + Math.floor(Math.random() * SCATTER.extraLen);
        Array.from({ length: Math.min(len, cols - x) }, (_, j) =>
          hit(y * cols + x + j),
        );
      });
      // 刷り直した字もときどき入れ替わる
      st.forEach((s, i) => {
        if (s && Math.random() < SCATTER.reroll) {
          ch[i] = randomChar();
          fresh[i] = 1;
        }
      });
    } else if (t < FLOOD_END) {
      // がーっと: 上の行から順に全部埋まる。字は毎回入れ替わる。
      const f = (t - SCATTER_END) / (FLOOD_END - SCATTER_END);
      st.forEach((s, i) => {
        if (!s && f > thresh[i]!) hit(i);
        else if (s && Math.random() < FLOOD.reroll) {
          ch[i] = randomChar();
          fresh[i] = Math.random() < FLOOD.fresh ? 1 : 0;
        }
      });
    } else {
      settle();
      return;
    }
    render();
    later(tick, TICK);
  };
  tick();

  later(() => {
    p.label.classList.add("jgs-e4-dkl");
    p.title.textContent = "";
  }, LABEL_DARK_AT);
  // 打ち直しの途中は末尾にカーソルを出す
  const chars = Array.from(title);
  chars.forEach((_, idx) => {
    const i = idx + 1;
    later(
      () => {
        p.title.textContent = chars.slice(0, i).join("");
        if (i < chars.length) {
          const caret = document.createElement("span");
          caret.className = "jgs-e4-caret";
          caret.textContent = "\u00a0";
          p.title.appendChild(caret);
        }
      },
      TYPE_START + i * TYPE_STEP,
    );
  });

  return stop;
}

// 闇落ち後のマーク。崩れ方は題から決まる (overwrite.ts)。
// clipPath の id は 1 ページにこのヘッダが 1 つしか無いので固定。
const CUT_TOP_ID = "jgs-e4-cut-top";
const CUT_BOTTOM_ID = "jgs-e4-cut-bottom";
const SHADOW_FILL = {
  cyan: "var(--color-glitch-cyan)",
  pink: "var(--color-glitch-pink)",
} as const;
// 試作の切り抜きの矩形 (viewBox の外まで余裕を持たせる)
// 崩れの強さと影の濃さ。試作の E4 の値。
const MARK_AMP = 0.8;
const SHADOW_OPACITY = 0.7;
const CLIP = { x: -30, pad: 30, width: 180, bottomHeight: 200 } as const;

const GlitchMarkSvg: React.FC<{ seed: string }> = ({ seed }) => {
  const m = glitchMarkParams(seed, MARK_AMP);
  const glyph = (
    i: number,
    rx: number,
    ry: number,
    extra: React.SVGProps<SVGGElement> = {},
  ) => (
    <g transform={`translate(${rx} ${ry})`} {...extra}>
      {createElement(GLYPHS[i]!.tag, GLYPHS[i]!.attrs)}
    </g>
  );
  return (
    <svg
      viewBox="0 0 115.17 108.76"
      aria-hidden="true"
      style={{ fill: "var(--color-abyss-mark)" }}
    >
      <defs>
        <clipPath id={CUT_TOP_ID}>
          <rect
            x={CLIP.x}
            y={-CLIP.pad}
            width={CLIP.width}
            height={m.cut + CLIP.pad}
          />
        </clipPath>
        <clipPath id={CUT_BOTTOM_ID}>
          <rect
            x={CLIP.x}
            y={m.cut}
            width={CLIP.width}
            height={CLIP.bottomHeight}
          />
        </clipPath>
      </defs>
      {m.glyphs.map((g, i) => (
        <React.Fragment key={i}>
          {g.shadow &&
            glyph(i, g.shadow.rx, g.ry, {
              style: { fill: SHADOW_FILL[g.shadow.color] },
              opacity: SHADOW_OPACITY,
            })}
          {g.split ? (
            <>
              {glyph(i, g.rx - g.split.d, g.ry, {
                clipPath: `url(#${CUT_TOP_ID})`,
              })}
              {glyph(i, g.rx + g.split.d, g.ry, {
                clipPath: `url(#${CUT_BOTTOM_ID})`,
              })}
            </>
          ) : (
            glyph(i, g.rx, g.ry)
          )}
        </React.Fragment>
      ))}
    </svg>
  );
};

export const OverwriteHeader: React.FC<{
  title: string;
  date: string | null;
}> = ({ title, date }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const dkRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const [root, noise, base, dk, label, t] = [
      rootRef.current,
      noiseRef.current,
      baseRef.current,
      dkRef.current,
      labelRef.current,
      titleRef.current,
    ];
    if (!root || !noise || !base || !dk || !label || !t) return;
    return runOverwrite({ root, noise, base, dk, label, title: t }, title);
  }, [title]);

  return (
    <div ref={rootRef} className="jgs-e4">
      <a href="/" aria-label="jgs.me" className="jgs-e4-bar">
        <div ref={baseRef} className="jgs-e4-base">
          <img src="/mark.svg" alt="" />
        </div>
        <div
          ref={noiseRef}
          className="jgs-e4-noise font-mono"
          aria-hidden="true"
        />
        <div ref={dkRef} className="jgs-e4-dk">
          <GlitchMarkSvg seed={title} />
        </div>
      </a>
      <div ref={labelRef} className="jgs-e4-label">
        <div className="jgs-e4-gl font-mono">
          <span className="jgs-e4-k">HTML</span>
          {/* full は幅を取るだけで見えない。見える字は typed (overwrite.css)。 */}
          <b className="jgs-e4-title">
            <span className="jgs-e4-title-full" aria-hidden="true">
              {title}
            </span>
            <span ref={titleRef} className="jgs-e4-typed">
              {title}
            </span>
          </b>
          {date && (
            <span className="jgs-e4-date">{date.replaceAll("-", "/")}</span>
          )}
        </div>
      </div>
    </div>
  );
};
