export interface FoundObject {
  ext: string;
  bytes: number;
  // D1 の CURRENT_TIMESTAMP と同じ "YYYY-MM-DD HH:MM:SS" (UTC)。
  created: string;
}

// w-media のキーは "<sha256>.<ext>"。id だけでは ext が分からないので
// 前方一致で探す。"." まで含めて、id を接頭辞に持つ別のキーには当てない。
export async function findObject(
  bucket: R2Bucket,
  id: string,
): Promise<FoundObject | null> {
  const { objects } = await bucket.list({ prefix: `${id}.`, limit: 1 });
  const obj = objects[0];
  if (!obj) return null;

  return {
    ext: obj.key.slice(id.length + 1),
    bytes: obj.size,
    created: obj.uploaded.toISOString().slice(0, 19).replace("T", " "),
  };
}
