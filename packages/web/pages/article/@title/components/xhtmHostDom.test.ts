// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, act, createElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { XhtmHost } from "./XhtmHost";
import type { XhtmPart } from "./xhtmPart";

declare global {
  interface Window {
    __host: string[];
  }
}

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.__host = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = null;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

// script は root の中に印を足し、片付けで外す。
const PART: XhtmPart = {
  styles: ["<style>.xhtm-host .a{color:red}</style>"],
  libs: [],
  body: '<div class="a">a</div>',
  scripts: [
    `window.__host.push("start");
     const s = document.createElement("span");
     s.className = "mark";
     root.appendChild(s);
     return () => { window.__host.push("stop"); s.remove(); };`,
  ],
};

// runXhtmPart は libs を待つので、effect の後に 1 拍置く。
const flush = () => act(async () => {});

describe("XhtmHost", () => {
  it("SSR で styles と body を入れ物に描き、hydrate 後に scripts を 1 回走らせる", async () => {
    const el = createElement(XhtmHost, { part: PART });
    container.innerHTML = renderToString(el);
    const host = container.querySelector(".xhtm-host");
    expect(host?.querySelector("style")).not.toBeNull();
    expect(host?.querySelector(".a")?.textContent).toBe("a");

    await act(async () => {
      root = hydrateRoot(container, el);
    });
    await flush();
    // 再描画でも走り直さない
    await act(async () =>
      root?.render(createElement(XhtmHost, { part: PART })),
    );
    await flush();

    expect(window.__host).toEqual(["start"]);
    expect(container.querySelectorAll(".mark")).toHaveLength(1);
  });

  it("unmount で片付ける", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(XhtmHost, { part: PART }));
    });
    await flush();
    await act(async () => root?.unmount());
    root = null;
    await flush();
    expect(window.__host).toEqual(["start", "stop"]);
  });

  it("StrictMode の 2 重 effect でも動いているのは 1 つだけ", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(XhtmHost, { part: PART }),
        ),
      );
    });
    await flush();
    const started = window.__host.filter((s) => s === "start").length;
    const stopped = window.__host.filter((s) => s === "stop").length;
    expect(started - stopped).toBe(1);
    expect(container.querySelectorAll(".mark")).toHaveLength(1);
  });
});
