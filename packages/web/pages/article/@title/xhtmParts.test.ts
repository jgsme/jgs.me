import { afterEach, describe, expect, it, vi } from "vitest";
import { loadXhtmParts } from "./xhtmParts";

// sha256 の 16 進は 64 文字
const SHA_HEX_LEN = 64;
const key = (c: string) => `${c.repeat(SHA_HEX_LEN)}.json`;

const PART = { styles: [], libs: [], body: "<p>a</p>", scripts: [] };

const xhtm = (k: string) => ({
  type: "codeBlock",
  fileName: "xhtm",
  content: `{"key":"${k}"}`,
});

// R2Bucket.get の代わり。値が Error なら json() が投げる (壊れた JSON)。
const bucket = (objects: Record<string, unknown>) => ({
  get: vi.fn(async (k: string) => {
    if (!(k in objects)) return null;
    const v = objects[k];
    return {
      json: async () => {
        if (v instanceof Error) throw v;
        return v;
      },
    };
  }),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadXhtmParts", () => {
  it("本文の code:xhtm のキーで部品を読む。同じキーは 1 回だけ読む", async () => {
    const b = bucket({ [key("a")]: PART });
    const parts = await loadXhtmParts(b, [
      xhtm(key("a")),
      { type: "line" },
      xhtm(key("a")),
    ]);
    expect(parts).toEqual({ [key("a")]: PART });
    expect(b.get).toHaveBeenCalledTimes(1);
  });

  it("xhtm が無ければ bucket に触らない (binding が無くても落ちない)", async () => {
    const parts = await loadXhtmParts(undefined, [
      { type: "codeBlock", fileName: "ts", content: "x" },
    ]);
    expect(parts).toEqual({});
  });

  it("xhtm があるのに bucket が無ければ 1 回 warn して空を返す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parts = await loadXhtmParts(undefined, [
      xhtm(key("a")),
      xhtm(key("b")),
    ]);
    expect(parts).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("キーの無いブロック・R2 に無い・壊れた JSON・形の違う部品は載せずに落ちない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const b = bucket({
      [key("b")]: new SyntaxError("bad json"),
      [key("c")]: { styles: "x" },
      [key("d")]: PART,
    });
    const parts = await loadXhtmParts(b, [
      { type: "codeBlock", fileName: "xhtm", content: "<div>old</div>" },
      xhtm(key("a")),
      xhtm(key("b")),
      xhtm(key("c")),
      xhtm(key("d")),
    ]);
    expect(parts).toEqual({ [key("d")]: PART });
  });

  it("bucket の get が投げても落ちない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const b = {
      get: vi.fn(async () => {
        throw new Error("r2 down");
      }),
    };
    await expect(loadXhtmParts(b, [xhtm(key("a"))])).resolves.toEqual({});
  });
});
