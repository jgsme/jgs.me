import type { FoundObject } from "./media";

export interface Tombstone {
  id: string;
  ext: string;
  bytes: number;
}

export interface UnpublishDeps {
  // 行があれば消した印を付けて true。
  markDeleted(id: string): Promise<boolean>;
  findObject(id: string): Promise<FoundObject | null>;
  insertTombstone(row: Tombstone): Promise<void>;
}

// ページを消す。R2 の実体は消さない。キーが内容の sha256 なので、同じ画像が
// micropub 由来や Gyazo 取り込み由来でも w-media に入っている可能性がある。
// 消すと記事本文の <img> が壊れる。
//
// 行の無い画像も R2 フォールバックでページになっているので、行が無ければ
// 消した印付きの行を作って覚えておく。
export async function unpublish(
  id: string,
  deps: UnpublishDeps,
): Promise<void> {
  if (await deps.markDeleted(id)) return;

  const obj = await deps.findObject(id);
  if (obj === null) return;

  await deps.insertTombstone({ id, ext: obj.ext, bytes: obj.bytes });
}
