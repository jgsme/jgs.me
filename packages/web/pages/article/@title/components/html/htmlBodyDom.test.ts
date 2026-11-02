// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { HtmlBody } from "./HtmlBody";
import { SpoilerGate } from "../SpoilerGate";

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = null;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

// SSR の HTML を置き、HTML の script が DOM を組み替えた体で書き換えてから
// hydrate する。
const ssrThenMutate = (el: ReactElement) => {
  container.innerHTML = renderToString(el);
  const article = container.querySelector(".jgs-html-article");
  if (!article) throw new Error("no container");
  article.appendChild(document.createElement("canvas"));
  return article;
};

describe("HtmlBody の hydration", () => {
  it("script が組み替えた DOM を hydration と再描画で消さない", async () => {
    const body = '<div class="jgs-html-article"><p>x</p></div>';
    const el = (n: number) =>
      createElement("div", { "data-n": n }, createElement(HtmlBody, { body }));
    const article = ssrThenMutate(el(0));

    await act(async () => {
      root = hydrateRoot(container, el(0));
    });
    await act(async () => root?.render(el(1)));

    expect(container.querySelector(".jgs-html-article")).toBe(article);
    expect(article.querySelector("canvas")).not.toBeNull();
  });
});

describe("SpoilerGate の onReveal", () => {
  it("表示するを押し、hidden が外れた後に 1 回だけ呼ぶ", async () => {
    const seen: (boolean | undefined)[] = [];
    const onReveal = vi.fn(() => {
      seen.push(
        container.querySelector(".jgs-html-article")?.closest("[hidden]") ===
          null,
      );
    });
    const el = () =>
      createElement(SpoilerGate, {
        spoiler: true,
        onReveal: () => onReveal(),
        children: createElement(HtmlBody, {
          body: '<div class="jgs-html-article">x</div>',
        }),
      });
    ssrThenMutate(el());
    await act(async () => {
      root = hydrateRoot(container, el());
    });
    expect(onReveal).not.toHaveBeenCalled();

    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "表示する",
    );
    await act(async () => button?.click());
    // 親の再描画で onReveal が新しい関数になっても呼び直さない。
    await act(async () => root?.render(el()));

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true]);
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
