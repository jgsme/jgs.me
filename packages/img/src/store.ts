import { mediaKey } from "@jigsaw/media";
import type { ParsedUpload } from "./upload";

export interface InsertRow {
  id: string;
  ext: string;
  sourceURL: string | null;
  srcURL: string | null;
  sourceTitle: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface StoreDeps {
  exists(id: string): Promise<boolean>;
  put(bytes: ArrayBuffer, contentType: string): Promise<string | null>;
  insert(row: InsertRow): Promise<void>;
}

export interface StoreResult {
  id: string;
  duplicate: boolean;
}

// 重複判定は D1 の行の有無だけで見る。R2 に同じキーがあっても
// (micropub 由来 / Gyazo 取り込み由来) 行が無ければ新規として扱う。
// put は同じ内容の上書きになるので無害。
export async function storeUpload(
  input: ParsedUpload,
  deps: StoreDeps,
): Promise<StoreResult | null> {
  const key = await mediaKey(input.bytes, input.contentType);
  if (key === null) return null;

  const [id, ext] = splitKey(key);

  if (await deps.exists(id)) return { id, duplicate: true };

  if ((await deps.put(input.bytes, input.contentType)) === null) return null;

  await deps.insert({
    id,
    ext,
    sourceURL: input.sourceURL,
    srcURL: input.srcURL,
    sourceTitle: input.sourceTitle,
    width: input.width,
    height: input.height,
    bytes: input.bytes.byteLength,
  });

  return { id, duplicate: false };
}

// mediaKey は "<sha256>.<ext>" を返す。sha256 は . を含まないので
// 最後の . で割れば済む。
function splitKey(key: string): [string, string] {
  const i = key.lastIndexOf(".");
  return [key.slice(0, i), key.slice(i + 1)];
}
