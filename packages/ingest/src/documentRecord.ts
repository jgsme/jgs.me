// HTML article (PDS ds.jgs.me の site.standard.document record) の読み取りと検証。
// diary は record を PDS に書いたあと、at-uri だけを Micropub で知らせてくる。
// zet と同じ流れで、payload から at-uri を取り出し、PDS から record を読み、
// jgs.me に載せられる形かを確かめる。DB と R2 は触らない。

import { pagePath } from "@jigsaw/db/page-path";
import {
  DOCUMENT_COLLECTION,
  HTML_CONTENT_TYPE,
  PUBLICATION_AT_URI,
  documentAtUri,
} from "@jigsaw/db/standard";
import { ZET_TITLE_PREFIX } from "@jigsaw/db/zet";
import {
  TID,
  fetchPdsRecord,
  propsOf,
  type FetchFn,
  type FetchRecordResult,
} from "./pdsRecord";

export const DOCUMENT_CATEGORY = "document";

const AT_URI_PREFIX = documentAtUri("");

// document の通知か。zet と同じく category で見分ける。
export function isDocumentPayload(payload: unknown): boolean {
  const category = propsOf(payload)?.["category"];
  return Array.isArray(category) && category.includes(DOCUMENT_CATEGORY);
}

export function parseDocumentAtUri(payload: unknown): {
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

export type DocumentContent = {
  type: "html";
  html: string;
  // diary のネタバレの印。省かれていれば false。
  spoiler: boolean;
  // 入れ物の style に入る color-scheme。省かれていれば null。
  colorScheme: string | null;
};

export type DocumentRecord = {
  title: string;
  // /pages/<encoded title>。title から決まる値なので照合するだけ。
  path: string;
  // ISO8601 UTC に正規化した値。
  publishedAt: string;
  updatedAt: string | null;
  content: DocumentContent;
};

// colorScheme は入れ物の style 属性に入るので、語を閉じる。
const COLOR_SCHEME_WORD = /^(normal|light|dark|only)$/;

function parseColorScheme(value: unknown): string | null {
  if (value === undefined) return null;
  const words = typeof value === "string" ? value.split(" ") : [];
  if (
    words.length < 1 ||
    words.length > 3 ||
    !words.every((w) => COLOR_SCHEME_WORD.test(w))
  ) {
    throw new Error("record content.colorScheme is invalid");
  }
  return words.join(" ");
}

function parseDatetime(value: unknown, name: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`record ${name} must be a datetime`);
  }
  return new Date(value).toISOString();
}

function parseContent(value: unknown): DocumentContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("record content must be an object");
  }
  const c = value as Record<string, unknown>;
  // sb の content 型はここに足す。
  switch (c["$type"]) {
    case HTML_CONTENT_TYPE:
      break;
    default:
      throw new Error(`unsupported content $type: ${String(c["$type"])}`);
  }
  if (typeof c.html !== "string" || c.html === "") {
    throw new Error("record content.html is required");
  }
  if (c.spoiler !== undefined && typeof c.spoiler !== "boolean") {
    throw new Error("record content.spoiler must be a boolean");
  }
  return {
    type: "html",
    html: c.html,
    spoiler: c.spoiler === true,
    colorScheme: parseColorScheme(c.colorScheme),
  };
}

// dirig は lexicon を検証しないので、形はここで確かめる。
export function parseDocumentRecordValue(value: unknown): DocumentRecord {
  if (!value || typeof value !== "object") {
    throw new Error("record value must be an object");
  }
  const v = value as Record<string, unknown>;
  if (v["$type"] !== DOCUMENT_COLLECTION) {
    throw new Error(`record $type must be ${DOCUMENT_COLLECTION}`);
  }
  if (v.site !== PUBLICATION_AT_URI) {
    throw new Error(`record site must be ${PUBLICATION_AT_URI}`);
  }
  if (typeof v.title !== "string" || v.title.trim() === "") {
    throw new Error("record title is required");
  }
  // .sb の 1 行目が題という不変条件 (body.ts) のため、改行を許さない。
  if (
    v.title !== v.title.trim() ||
    v.title.includes("\r") ||
    v.title.includes("\n")
  ) {
    throw new Error(
      "record title must be a single line without surrounding spaces",
    );
  }
  // zet は page.title が zet:<rkey> なので、記事の題が衝突しないよう弾く。
  if (v.title.startsWith(ZET_TITLE_PREFIX)) {
    throw new Error(`record title must not start with ${ZET_TITLE_PREFIX}`);
  }
  const path = pagePath(v.title);
  if (v.path !== path) throw new Error(`record path must be ${path}`);
  const publishedAt = parseDatetime(v.publishedAt, "publishedAt");
  const updatedAt =
    v.updatedAt === undefined ? null : parseDatetime(v.updatedAt, "updatedAt");
  return {
    title: v.title,
    path,
    publishedAt,
    updatedAt,
    content: parseContent(v.content),
  };
}

export type FetchDocumentResult = FetchRecordResult<DocumentRecord>;

export function fetchDocumentRecord(
  rkey: string,
  fetchFn: FetchFn,
): Promise<FetchDocumentResult> {
  return fetchPdsRecord(
    DOCUMENT_COLLECTION,
    rkey,
    parseDocumentRecordValue,
    fetchFn,
  );
}
