// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLibLoader,
  parseXhtmBlock,
  parseXhtmPart,
  runXhtmPart,
  type XhtmPart,
} from "./xhtmPart";

// sha256 の 16 進は 64 文字
const SHA_HEX_LEN = 64;
const HEX = "a".repeat(SHA_HEX_LEN);
const KEY = `${HEX}.json`;

const part = (p: Partial<XhtmPart>): XhtmPart => ({
  styles: [],
  libs: [],
  body: "",
  scripts: [],
  ...p,
});

const noLibs = async () => {
  throw new Error("lib は無いはず");
};

// script から呼べるように window に記録先を置く。
type Log = { calls: string[]; roots: Element[] };
declare global {
  interface Window {
    __xhtm: Log;
  }
}

const freshLog = (): Log => {
  window.__xhtm = { calls: [], roots: [] };
  return window.__xhtm;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseXhtmBlock", () => {
  it("1 行の JSON からキーを取る", () => {
    expect(parseXhtmBlock(`{"key":"${KEY}"}`)).toBe(KEY);
    expect(parseXhtmBlock(`  {"key":"${KEY}"}\n`)).toBe(KEY);
  });

  it.each([
    "",
    "<div>x</div>",
    "{",
    "null",
    "[]",
    `"${KEY}"`,
    "{}",
    '{"key":1}',
    '{"key":"../x.json"}',
    `{"key":"${HEX.toUpperCase()}.json"}`,
    `{"key":"${HEX}.png"}`,
  ])("キーの形でないもの・JSON でないものは null: %s", (s) => {
    expect(parseXhtmBlock(s)).toBeNull();
  });
});

describe("parseXhtmPart", () => {
  it("4 つのフィールドが揃っていれば部品にする", () => {
    const p = {
      styles: ["<style>.a{}</style>"],
      libs: ["https://cdn.jsdelivr.net/npm/x@1/x.js"],
      body: "<div>a</div>",
      scripts: ["return () => {}"],
    };
    expect(parseXhtmPart(p)).toEqual(p);
  });

  it.each([
    null,
    "x",
    [],
    {},
    { styles: [], libs: [], body: "" },
    { styles: "x", libs: [], body: "", scripts: [] },
    { styles: [1], libs: [], body: "", scripts: [] },
    { styles: [], libs: [], body: 1, scripts: [] },
    { styles: [], libs: [], body: "", scripts: [null] },
  ])("形が違えば null: %j", (v) => {
    expect(parseXhtmPart(v)).toBeNull();
  });
});

describe("runXhtmPart", () => {
  it("scripts を元の順に root を渡して呼ぶ", async () => {
    const log = freshLog();
    const root = document.createElement("div");
    await runXhtmPart(
      root,
      part({
        scripts: [
          "window.__xhtm.calls.push('1'); window.__xhtm.roots.push(root);",
          "window.__xhtm.calls.push('2'); window.__xhtm.roots.push(root);",
        ],
      }),
      noLibs,
    );
    expect(log.calls).toEqual(["1", "2"]);
    expect(log.roots).toEqual([root, root]);
  });

  it("dispose は返された片付けを逆順に呼ぶ", async () => {
    const log = freshLog();
    const dispose = await runXhtmPart(
      document.createElement("div"),
      part({
        scripts: [
          "return () => window.__xhtm.calls.push('c1')",
          "window.__xhtm.calls.push('no cleanup')",
          "return () => window.__xhtm.calls.push('c3')",
        ],
      }),
      noLibs,
    );
    expect(log.calls).toEqual(["no cleanup"]);
    dispose();
    expect(log.calls).toEqual(["no cleanup", "c3", "c1"]);
    // 2 回呼んでも片付けは 1 回
    dispose();
    expect(log.calls).toEqual(["no cleanup", "c3", "c1"]);
  });

  it("例外を投げた script があっても後続は走り、片付けは走った分だけ呼ぶ", async () => {
    const log = freshLog();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dispose = await runXhtmPart(
      document.createElement("div"),
      part({
        scripts: [
          "window.__xhtm.calls.push('1'); return () => window.__xhtm.calls.push('c1')",
          "throw new Error('boom')",
          "this is not js",
          "window.__xhtm.calls.push('4'); return () => window.__xhtm.calls.push('c4')",
        ],
      }),
      noLibs,
    );
    expect(log.calls).toEqual(["1", "4"]);
    // 投げた script と構文の誤りの 2 本
    const THROWN = 2;
    expect(error).toHaveBeenCalledTimes(THROWN);
    dispose();
    expect(log.calls).toEqual(["1", "4", "c4", "c1"]);
  });

  it("片付けが例外を投げても残りの片付けを呼ぶ", async () => {
    const log = freshLog();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dispose = await runXhtmPart(
      document.createElement("div"),
      part({
        scripts: [
          "return () => window.__xhtm.calls.push('c1')",
          "return () => { throw new Error('x') }",
        ],
      }),
      noLibs,
    );
    expect(() => dispose()).not.toThrow();
    expect(log.calls).toEqual(["c1"]);
  });

  it("他の部品の例外に巻き込まれない", async () => {
    const log = freshLog();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runXhtmPart(
      document.createElement("div"),
      part({ scripts: ["throw new Error('a')"] }),
      noLibs,
    );
    await runXhtmPart(
      document.createElement("div"),
      part({ scripts: ["window.__xhtm.calls.push('b')"] }),
      noLibs,
    );
    expect(log.calls).toEqual(["b"]);
  });

  it("libs を全部読み終えてから scripts を呼ぶ", async () => {
    const log = freshLog();
    const loaded: string[] = [];
    const loadLib = vi.fn(async (src: string) => {
      await Promise.resolve();
      loaded.push(src);
      log.calls.push(`lib ${src}`);
    });
    await runXhtmPart(
      document.createElement("div"),
      part({
        libs: ["a.js", "b.js"],
        scripts: ["window.__xhtm.calls.push('s')"],
      }),
      loadLib,
    );
    expect(loadLib.mock.calls.map((c) => c[0])).toEqual(["a.js", "b.js"]);
    expect(log.calls.at(-1)).toBe("s");
    expect(loaded).toEqual(["a.js", "b.js"]);
  });

  it("lib の読み込みが失敗したらその部品の scripts を呼ばない", async () => {
    const log = freshLog();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dispose = await runXhtmPart(
      document.createElement("div"),
      part({ libs: ["bad.js"], scripts: ["window.__xhtm.calls.push('s')"] }),
      async () => {
        throw new Error("load failed");
      },
    );
    expect(log.calls).toEqual([]);
    expect(error).toHaveBeenCalled();
    expect(() => dispose()).not.toThrow();
  });

  it("libs を読み終える前に止めたら scripts を呼ばない", async () => {
    const log = freshLog();
    let finish: () => void = () => {};
    const pending = new Promise<void>((r) => (finish = r));
    const ac = new AbortController();
    const running = runXhtmPart(
      document.createElement("div"),
      part({ libs: ["slow.js"], scripts: ["window.__xhtm.calls.push('s')"] }),
      () => pending,
      ac.signal,
    );
    ac.abort();
    finish();
    const dispose = await running;
    expect(log.calls).toEqual([]);
    dispose();
  });

  it("StrictMode 相当 (run → cleanup → run) で二重に残らない", async () => {
    const log = freshLog();
    const root = document.createElement("div");
    const p = part({
      libs: ["x.js"],
      scripts: [
        "window.__xhtm.calls.push('start'); return () => window.__xhtm.calls.push('stop')",
      ],
    });
    const loadLib = async () => {};

    // effect の 1 回目と、即座に呼ばれる cleanup
    const ac1 = new AbortController();
    const first = runXhtmPart(root, p, loadLib, ac1.signal);
    ac1.abort();
    void (async () => (await first)())();
    // effect の 2 回目
    const ac2 = new AbortController();
    const second = await runXhtmPart(root, p, loadLib, ac2.signal);
    await first;

    expect(log.calls).toEqual(["start"]);
    second();
    expect(log.calls).toEqual(["start", "stop"]);
  });

  it("走り終えた後の run → dispose → run でも動いているのは 1 つだけ", async () => {
    const log = freshLog();
    const root = document.createElement("div");
    const p = part({
      scripts: [
        "window.__xhtm.calls.push('start'); return () => window.__xhtm.calls.push('stop')",
      ],
    });
    (await runXhtmPart(root, p, noLibs))();
    const d = await runXhtmPart(root, p, noLibs);
    expect(log.calls).toEqual(["start", "stop", "start"]);
    d();
  });
});

describe("createLibLoader", () => {
  const fakeDoc = () => {
    const appended: Array<
      HTMLScriptElement & { fire: (t: "load" | "error") => void }
    > = [];
    const doc = {
      createElement: () => {
        const listeners: Record<string, () => void> = {};
        const el = {
          src: "",
          async: true,
          set onload(f: () => void) {
            listeners.load = f;
          },
          set onerror(f: () => void) {
            listeners.error = f;
          },
          remove: vi.fn(),
          fire: (t: "load" | "error") => listeners[t]?.(),
        };
        return el;
      },
      head: {
        appendChild: (el: (typeof appended)[number]) => {
          appended.push(el);
          return el;
        },
      },
    };
    return { doc: doc as unknown as Document, appended };
  };

  it("同じ src は 1 回しか読まず、async = false で足す", async () => {
    const { doc, appended } = fakeDoc();
    const load = createLibLoader(doc);
    const a = load("https://cdn.jsdelivr.net/npm/a@1/a.js");
    const b = load("https://cdn.jsdelivr.net/npm/a@1/a.js");
    expect(appended).toHaveLength(1);
    expect(appended[0]!.src).toBe("https://cdn.jsdelivr.net/npm/a@1/a.js");
    expect(appended[0]!.async).toBe(false);
    appended[0]!.fire("load");
    await expect(a).resolves.toBeUndefined();
    await expect(b).resolves.toBeUndefined();
    await load("https://cdn.jsdelivr.net/npm/a@1/a.js");
    expect(appended).toHaveLength(1);
  });

  it("読み込みに失敗したら reject し、次は読み直す", async () => {
    const { doc, appended } = fakeDoc();
    const load = createLibLoader(doc);
    const a = load("https://example.com/x.js");
    appended[0]!.fire("error");
    await expect(a).rejects.toThrow();
    void load("https://example.com/x.js");
    const RETRIED = 2;
    expect(appended).toHaveLength(RETRIED);
  });
});
