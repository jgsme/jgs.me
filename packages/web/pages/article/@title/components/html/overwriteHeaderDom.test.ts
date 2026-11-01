// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OverwriteHeader } from "./OverwriteHeader";

const TITLE = "部屋の CO2";
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const full = () => container.querySelector(".jgs-e4-title-full");
const typed = () => container.querySelector(".jgs-e4-typed");

// 打ち直しの途中で題の幅が変わると、横の日付が動く (CLS)。幅を決める全文は
// 演出の最初から最後まで見えないまま残り、見える字だけが上に重なって変わる。
it("打ち直しの間も、幅を取る全文は全部の字のまま残る", () => {
  act(() =>
    root.render(
      createElement(OverwriteHeader, { title: TITLE, date: "2026-10-31" }),
    ),
  );
  expect(full()?.textContent).toBe(TITLE);
  expect(full()?.getAttribute("aria-hidden")).toBe("true");
  expect(typed()?.textContent).toBe(TITLE);

  // 1080 + 3×40ms: 3 字まで打ち直した途中。カーソルは typed の中に居る
  act(() => vi.advanceTimersByTime(1200));
  expect(full()?.textContent).toBe(TITLE);
  expect(typed()?.textContent).toBe("部屋の ");
  expect(typed()?.querySelector(".jgs-e4-caret")).not.toBeNull();
  expect(full()?.querySelector(".jgs-e4-caret")).toBeNull();

  act(() => vi.advanceTimersByTime(2000));
  expect(full()?.textContent).toBe(TITLE);
  expect(typed()?.textContent).toBe(TITLE);
});
