import React, { useEffect, useRef } from "react";

// スクリーンセーバーの 404。開始位置と速度はデザイン (3a) の値をそのまま使う。
const START_X = 40;
const START_Y = 30;

// デザインの速度は 60fps 前提の px/frame。そのまま毎フレーム足すと
// 120Hz の画面で 2 倍速く動くので、px/ms に直して経過時間を掛ける。
const FRAME_MS = 1000 / 60;
const VX = 0.42 / FRAME_MS;
const VY = 0.29 / FRAME_MS;

// タブを離れて戻った直後は経過時間が跳ねる。そのぶん一気に進めると
// 画面の端から端までワープしたように見えるので上限で切る。
const MAX_STEP_MS = 50;

const BASE_OPACITY = "0.6";
const BUMP_OPACITY = "0.3";
const BUMP_MS = 200;

// 跳ね返る枠は position: relative な親 (= offsetParent)。
// left/top の基準と一致するので、親を props で渡さずに済む。
export const BouncingCode = () => {
  const puckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const puck = puckRef.current;
    if (!puck) return;

    let x = START_X;
    let y = START_Y;
    let vx = VX;
    let vy = VY;
    let raf = 0;
    let prev = 0;
    let bump: ReturnType<typeof setTimeout> | undefined;

    const flash = () => {
      puck.style.opacity = BUMP_OPACITY;
      clearTimeout(bump);
      bump = setTimeout(() => {
        puck.style.opacity = BASE_OPACITY;
      }, BUMP_MS);
    };

    const step = (now: number) => {
      raf = requestAnimationFrame(step);

      // 初回は基準が無いので進めない。次のフレームから経過時間が出る。
      const dt = prev === 0 ? 0 : Math.min(now - prev, MAX_STEP_MS);
      prev = now;

      const stage = puck.offsetParent as HTMLElement | null;
      if (!stage) return;

      const w = stage.clientWidth - puck.offsetWidth;
      const h = stage.clientHeight - puck.offsetHeight;
      // レイアウト前や 404 が枠より大きい画面では跳ね返る余地が無い。
      // 座標を進めずに次のフレームを待つ。
      if (w <= 0 || h <= 0) return;

      x += vx * dt;
      y += vy * dt;

      if (x <= 0) {
        x = 0;
        vx = -vx;
        flash();
      }
      if (x >= w) {
        x = w;
        vx = -vx;
        flash();
      }
      if (y <= 0) {
        y = 0;
        vy = -vy;
        flash();
      }
      if (y >= h) {
        y = h;
        vy = -vy;
        flash();
      }

      puck.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };

    const start = () => {
      prev = 0;
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(bump);
      puck.style.opacity = BASE_OPACITY;
    };

    // 動きを減らす設定なら止めたまま置く。設定は途中でも切り替わるので購読する。
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (reduced.matches) stop();
      else if (raf === 0) start();
    };

    sync();
    reduced.addEventListener("change", sync);

    return () => {
      stop();
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div
      ref={puckRef}
      className="pointer-events-none absolute top-0 left-0 z-[1] font-mono text-[clamp(3.5rem,18vw,7.5rem)] leading-none font-medium tracking-[-0.05em] text-paper opacity-60 transition-opacity duration-200 will-change-transform"
      style={{ transform: `translate(${START_X}px, ${START_Y}px)` }}
    >
      404
    </div>
  );
};
