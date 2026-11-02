// PDS (ds.jgs.me) の record を getRecord で引く共通部分。zet と
// site.standard.document が同じ PDS・同じ失敗の分類を使う。DB と R2 は触らない。

import { ZET_DID as PDS_DID } from "@jigsaw/db/zet";

export const PDS_URL = "https://ds.jgs.me";
export { PDS_DID };

// Workers の global fetch を引数に渡すときは素の参照を渡さない
// (this が外れて Illegal invocation になる)。呼び出し側で
// (input, init) => fetch(input, init) に包んで渡す。
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// TID (atproto の時刻順 ID)。rkey は page.title や at-uri にそのまま入るので、
// 文字種をここで閉じる。
export const TID = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

export function propsOf(payload: unknown): Record<string, unknown> | null {
  const props = (payload as { properties?: unknown } | null)?.properties;
  if (!props || typeof props !== "object") return null;
  return props as Record<string, unknown>;
}

export function getRecordURL(collection: string, rkey: string): string {
  const u = new URL("/xrpc/com.atproto.repo.getRecord", PDS_URL);
  u.searchParams.set("repo", PDS_DID);
  u.searchParams.set("collection", collection);
  u.searchParams.set("rkey", rkey);
  return u.toString();
}

export type FetchedRecord<T> = {
  uri: string;
  cid: string;
  record: T;
  // getRecord のレスポンスそのもの。object.atproto に原本として残す。
  raw: string;
};

export type FetchRecordResult<T> =
  | { ok: true; got: FetchedRecord<T> }
  | { ok: false; status: 400 | 502; description: string };

// 呼び出し元 (diary) が直せる失敗 (record が無い・壊れている) は 400、
// PDS 側の不調は 502 にする。diary は 502 なら再送してよい。
export async function fetchPdsRecord<T>(
  collection: string,
  rkey: string,
  parse: (value: unknown) => T,
  fetchFn: FetchFn,
): Promise<FetchRecordResult<T>> {
  let res: Response;
  try {
    res = await fetchFn(getRecordURL(collection, rkey), {
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      description: `pds unreachable: ${String(e)}`,
    };
  }

  // dirig は無い record を 400 RecordNotFound で返す (XRPC の慣例)。
  if (res.status === 400) {
    const err = (await res.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (err?.error === "RecordNotFound") {
      return {
        ok: false,
        status: 400,
        description: `record not found: ${rkey}`,
      };
    }
    return { ok: false, status: 502, description: "pds returned 400" };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: 502,
      description: `pds returned ${res.status}`,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: 502, description: "pds returned invalid json" };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 502, description: "pds returned invalid json" };
  }
  const b = body as { uri?: unknown; cid?: unknown; value?: unknown };
  if (typeof b.uri !== "string" || typeof b.cid !== "string") {
    return {
      ok: false,
      status: 502,
      description: "pds response lacks uri/cid",
    };
  }

  let record: T;
  try {
    record = parse(b.value);
  } catch (e) {
    return {
      ok: false,
      status: 400,
      description: `invalid record: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return {
    ok: true,
    got: { uri: b.uri, cid: b.cid, record, raw: JSON.stringify(body) },
  };
}
