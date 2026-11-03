// code:xhtm の部品。diary が publish 時に部品を JSON にして w-media に置き、
// 記事のブロックは {"key":"<sha256>.json"} 1 行だけを持つ。
// ここは React に依存しない (読み取りと実行の約束だけ)。

export type XhtmPart = {
  // <style> / <link rel="stylesheet"> の HTML (元の順)
  styles: string[];
  // 外部 script の URL (元の順)
  libs: string[];
  // body の中身
  body: string;
  // inline script の中身。root を受け取り、片付けの関数を返してよい関数の中身
  scripts: string[];
};

// 部品を描く入れ物の class
export const XHTM_HOST_CLASS = "xhtm-host";

// キーは中身の sha256 の 16 進 + .json (media endpoint が決める)。
// 通す: "<小文字 16 進 64 文字>.json"。弾く: "../x.json"、大文字の 16 進、".png"
const KEY_PATTERN = /^[0-9a-f]{64}\.json$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

const parseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// ブロックの中身からキーを取る。形が違えば null。
export const parseXhtmBlock = (content: string): string | null => {
  const v = parseJson(content.trim());
  if (!isRecord(v) || typeof v.key !== "string") return null;
  return KEY_PATTERN.test(v.key) ? v.key : null;
};

export const parseXhtmPart = (json: unknown): XhtmPart | null => {
  if (!isRecord(json)) return null;
  const { styles, libs, body, scripts } = json;
  if (
    !isStringArray(styles) ||
    !isStringArray(libs) ||
    typeof body !== "string" ||
    !isStringArray(scripts)
  ) {
    return null;
  }
  return { styles, libs, body, scripts };
};

type Cleanup = () => void;

const callScript = (root: HTMLElement, code: string): Cleanup | null => {
  try {
    // 部品の script の約束: root を受け取る関数の中身。戻り値が関数なら片付け。
    const ret: unknown = new Function("root", code)(root);
    return typeof ret === "function" ? (ret as Cleanup) : null;
  } catch (e) {
    console.error("xhtm: script failed", e);
    return null;
  }
};

const disposeAll = (cleanups: Cleanup[]): void => {
  cleanups.toReversed().forEach((f) => {
    try {
      f();
    } catch (e) {
      console.error("xhtm: cleanup failed", e);
    }
  });
};

// libs を全部読み終えてから scripts を元の順に呼び、片付けの関数を返す。
// signal が止まっていたら scripts を呼ばない (読み込み中に unmount されたとき)。
// lib の読み込みが 1 つでも失敗したら、その部品の scripts は呼ばない。
export const runXhtmPart = async (
  root: HTMLElement,
  part: XhtmPart,
  loadLib: (src: string) => Promise<void>,
  signal?: AbortSignal,
): Promise<Cleanup> => {
  const noop: Cleanup = () => {};
  try {
    await Promise.all(part.libs.map((src) => loadLib(src)));
  } catch (e) {
    console.error("xhtm: lib failed", e);
    return noop;
  }
  if (signal?.aborted) return noop;
  const cleanups = part.scripts
    .map((code) => callScript(root, code))
    .filter((f): f is Cleanup => f !== null);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    disposeAll(cleanups);
  };
};

// 外部 script をページに 1 回だけ足す。同じ src は同じ Promise を返す。
// async = false で足すので、読み終えた順でなく足した順に実行される。
// 失敗したものは覚えず、次に頼まれたら読み直す。
export const createLibLoader = (
  doc: Document,
): ((src: string) => Promise<void>) => {
  const loading = new Map<string, Promise<void>>();
  return (src) => {
    const known = loading.get(src);
    if (known) return known;
    const p = new Promise<void>((resolve, reject) => {
      const el = doc.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = () => resolve();
      el.onerror = () => {
        loading.delete(src);
        el.remove();
        reject(new Error(`xhtm: failed to load ${src}`));
      };
      doc.head.appendChild(el);
    });
    loading.set(src, p);
    return p;
  };
};

let pageLoader: ((src: string) => Promise<void>) | null = null;

// ページ内で共有する loader (ブラウザでだけ呼ぶ)
export const loadLib = (src: string): Promise<void> => {
  pageLoader ??= createLibLoader(document);
  return pageLoader(src);
};
