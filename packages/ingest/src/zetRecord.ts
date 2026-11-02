// zet (PDS ds.jgs.me の me.jgs.diary.zet record) の読み取りと検証。
// diary は record を PDS に書いたあと、at-uri だけを Micropub で知らせてくる
// (本文は送らない)。ここでは payload から at-uri を取り出し、PDS から record を
// 読み、jgs.me に載せられる形かを確かめる。DB と R2 は触らない。

import { ZET_COLLECTION } from "@jigsaw/db/zet";
import {
  PDS_DID,
  PDS_URL,
  TID,
  fetchPdsRecord,
  getRecordURL as getPdsRecordURL,
  propsOf,
  type FetchFn,
} from "./pdsRecord";

// 既存の import 元 (zetBlob など) のために再 export する。
export { PDS_DID, PDS_URL, ZET_COLLECTION };
export type { FetchFn };
export const ZET_CATEGORY = "zet";

const AT_URI_PREFIX = `at://${PDS_DID}/${ZET_COLLECTION}/`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  // diary のネタバレの印。省かれていれば false。
  spoiler: boolean;
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
  if (v.spoiler !== undefined && typeof v.spoiler !== "boolean") {
    throw new Error("record spoiler must be a boolean");
  }
  const title =
    typeof v.title === "string" && v.title.trim() !== "" ? v.title : null;
  return {
    text: v.text,
    title,
    date: v.date,
    createdAt: new Date(v.createdAt).toISOString(),
    spoiler: v.spoiler === true,
  };
}

export function getRecordURL(rkey: string): string {
  return getPdsRecordURL(ZET_COLLECTION, rkey);
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

export async function fetchZetRecord(
  rkey: string,
  fetchFn: FetchFn,
): Promise<FetchZetResult> {
  const r = await fetchPdsRecord(
    ZET_COLLECTION,
    rkey,
    parseZetRecordValue,
    fetchFn,
  );
  return r.ok ? { ok: true, zet: r.got } : r;
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
