// zet と document の取り込みが共有する応答と失敗の扱い。

// Micropub のエラー応答。error は 5xx なら server_error、それ以外は
// invalid_request。409 の conflict のように別の語を返すときだけ渡す。
export function fail(
  status: number,
  description: string,
  error?: string,
): Response {
  return Response.json(
    {
      error: error ?? (status >= 500 ? "server_error" : "invalid_request"),
      error_description: description,
    },
    { status },
  );
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// 失敗しても取り込みは成功させる (micropub.ts の create / update と同じ判断)。
// ただし再送では直せない: 同じ CID の再送は取り込み済みとして publish せずに
// 返るため、配送・purge に失敗したものは再送しても配送されない。
// 復旧は /internal/publish を手で叩く。label はログの頭 ("[zet] purge" など)。
export async function bestEffort(
  label: string,
  f: () => Promise<void>,
): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.error(`${label} failed ${message(e)}`);
  }
}
