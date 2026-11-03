import {
  parseXhtmBlock,
  parseXhtmPart,
  type XhtmPart,
} from "./components/xhtmPart";

export type XhtmParts = Record<string, XhtmPart>;

type Bucket = {
  get: (key: string) => Promise<{ json: () => Promise<unknown> } | null>;
};

type Block = { type: string; fileName?: string; content?: string };

const xhtmKeys = (blocks: ReadonlyArray<Block>): string[] => [
  ...new Set(
    blocks
      .filter((b) => b.type === "codeBlock" && b.fileName === "xhtm")
      .map((b) => parseXhtmBlock(b.content ?? ""))
      .filter((k): k is string => k !== null),
  ),
];

const loadOne = async (
  bucket: Bucket,
  key: string,
): Promise<XhtmPart | null> => {
  try {
    const obj = await bucket.get(key);
    if (obj === null) return null;
    return parseXhtmPart(await obj.json());
  } catch (e) {
    console.warn("xhtm: part unreadable", key, e);
    return null;
  }
};

// 本文の code:xhtm が指す部品を w-media から読む。読めない・壊れたものは
// 載せない (その部品だけ描かれず、ページは落とさない)。
export const loadXhtmParts = async (
  bucket: Bucket | undefined,
  blocks: ReadonlyArray<Block>,
): Promise<XhtmParts> => {
  const keys = xhtmKeys(blocks);
  if (keys.length === 0) return {};
  if (bucket === undefined) {
    console.warn("xhtm: MEDIA binding is missing", keys);
    return {};
  }
  const loaded = await Promise.all(
    keys.map(async (k) => [k, await loadOne(bucket, k)] as const),
  );
  return Object.fromEntries(
    loaded.filter((e): e is readonly [string, XhtmPart] => e[1] !== null),
  );
};
