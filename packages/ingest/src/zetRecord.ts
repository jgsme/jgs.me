// zet (PDS ds.jgs.me の me.jgs.diary.zet record) の読み取りと検証。
// diary は record を PDS に書いたあと、at-uri だけを Micropub で知らせてくる
// (本文は送らない)。ここでは payload から at-uri を取り出し、PDS から record を
// 読み、jgs.me に載せられる形かを確かめる。DB と R2 は触らない。

import { ZET_DID as PDS_DID, ZET_COLLECTION } from "@jigsaw/db/zet";

export const PDS_URL = "https://ds.jgs.me";
export { PDS_DID, ZET_COLLECTION };
export const ZET_CATEGORY = "zet";

// Workers の global fetch を引数に渡すときは素の参照を渡さない
// (this が外れて Illegal invocation になる)。呼び出し側で
// (input, init) => fetch(input, init) に包んで渡す。
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const AT_URI_PREFIX = `at://${PDS_DID}/${ZET_COLLECTION}/`;

// TID (atproto の時刻順 ID)。rkey は page.title (zet:<rkey>)
// にそのまま入るので、文字種をここで閉じる。
const TID = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function propsOf(payload: unknown): Record<string, unknown> | null {
  const props = (payload as { properties?: unknown } | null)?.properties;
  if (!props || typeof props !== "object") return null;
  return props as Record<string, unknown>;
}

// zet の通知か。clip と同じく category で見分ける (mf2.ts の isClip と同じ器)。
export function isZetPayload(payload: unknown): boolean {
  const category = propsOf(payload)?.["category"];
  return Array.isArray(category) && category.includes(ZET_CATEGORY);
}

export function parseZetAtUri(payload: unknown): {
  atUri: string;
  rkey: string;
} {
  const v = propsOf(payload)?.["at-uri"];
  const raw = Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
  if (raw === null) throw new Error("at-uri is required");
  if (!raw.startsWith(AT_URI_PREFIX)) {
    throw new Error(`at-uri must be ${AT_URI_PREFIX}<rkey>: ${raw}`);
  }
  const rkey = raw.slice(AT_URI_PREFIX.length);
  if (!TID.test(rkey)) throw new Error(`at-uri rkey is not a TID: ${raw}`);
  return { atUri: raw, rkey };
}

export type ZetRecord = {
  // Scrapbox 記法の本文。画像は getBlob URL に差し替え済み (diary 側)。
  text: string;
  // 省かれた record と空白だけの題は null。
  title: string | null;
  // "YYYY-MM-DD"
  date: string;
  // ISO8601 UTC に正規化した値。page.created に入る。
  createdAt: string;
};

// dirig は lexicon を検証しないので、形はここで確かめる。
export function parseZetRecordValue(value: unknown): ZetRecord {
  if (!value || typeof value !== "object") {
    throw new Error("record value must be an object");
  }
  const v = value as Record<string, unknown>;
  if (v["$type"] !== ZET_COLLECTION) {
    throw new Error(`record $type must be ${ZET_COLLECTION}`);
  }
  if (typeof v.text !== "string" || v.text.trim() === "") {
    throw new Error("record text is required");
  }
  if (typeof v.date !== "string" || !DATE.test(v.date)) {
    throw new Error("record date must be YYYY-MM-DD");
  }
  if (
    typeof v.createdAt !== "string" ||
    Number.isNaN(Date.parse(v.createdAt))
  ) {
    throw new Error("record createdAt must be a datetime");
  }
  if (v.title !== undefined && typeof v.title !== "string") {
    throw new Error("record title must be a string");
  }
  const title =
    typeof v.title === "string" && v.title.trim() !== "" ? v.title : null;
  return {
    text: v.text,
    title,
    date: v.date,
    createdAt: new Date(v.createdAt).toISOString(),
  };
}

export function getRecordURL(rkey: string): string {
  const u = new URL("/xrpc/com.atproto.repo.getRecord", PDS_URL);
  u.searchParams.set("repo", PDS_DID);
  u.searchParams.set("collection", ZET_COLLECTION);
  u.searchParams.set("rkey", rkey);
  return u.toString();
}

export type FetchedZet = {
  uri: string;
  cid: string;
  record: ZetRecord;
  // getRecord のレスポンスそのもの。object.atproto に原本として残す。
  raw: string;
};

export type FetchZetResult =
  | { ok: true; zet: FetchedZet }
  | { ok: false; status: 400 | 502; description: string };

// 呼び出し元 (diary) が直せる失敗 (record が無い・壊れている) は 400、
// PDS 側の不調は 502 にする。diary は 502 なら再送してよい。
export async function fetchZetRecord(
  rkey: string,
  fetchFn: FetchFn,
): Promise<FetchZetResult> {
  let res: Response;
  try {
    res = await fetchFn(getRecordURL(rkey), {
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

  let record: ZetRecord;
  try {
    record = parseZetRecordValue(b.value);
  } catch (e) {
    return {
      ok: false,
      status: 400,
      description: `invalid record: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return {
    ok: true,
    zet: { uri: b.uri, cid: b.cid, record, raw: JSON.stringify(body) },
  };
}

// getBlob の URL には拡張子が無く、scrapbox-parser は [URL] を画像ではなく
// リンクと読む。fragment に拡張子を足すと画像と読まれ、fragment はサーバに
// 送られないので取得結果は変わらない。R2 に書く写しにだけ付け、PDS の原本は
// 書き換えない。既に # が付いた URL には足さない (2 回通しても 1 つ)。
export const BLOB_IMAGE_MARK = "#.png";

const BLOB_URL =
  /(https:\/\/ds\.jgs\.me\/xrpc\/com\.atproto\.sync\.getBlob\?[^\s\]#]+)(?=[\s\]])/g;

export function markBlobImages(text: string): string {
  return text.replace(BLOB_URL, `$1${BLOB_IMAGE_MARK}`);
}

// 既に付いた fragment (#.png) ごと拾う。page.image のように URL だけの
// 文字列も通すので、末尾でも止まる。R2 の URL に差し替えると拡張子が
// 付くので印は要らない。g 付きなので呼ぶたびに作る (gyazo.ts と同じ理由)。
function blobURLPattern(): RegExp {
  return /(https:\/\/ds\.jgs\.me\/xrpc\/com\.atproto\.sync\.getBlob\?[^\s\]#]+)(?:#[^\s\]]*)?(?=[\s\]]|$)/g;
}

// 本文中の getBlob URL (fragment を除いた形) を重複なしで返す。
export function extractBlobURLs(text: string): string[] {
  return [...new Set([...text.matchAll(blobURLPattern())].map((m) => m[1]!))];
}

// resolved に無い URL は元のまま残す。
export function replaceBlobURLs(
  text: string,
  resolved: ReadonlyMap<string, string>,
): string {
  return text.replace(
    blobURLPattern(),
    (match, url: string) => resolved.get(url) ?? match,
  );
}
