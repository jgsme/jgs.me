// standard.site (site.standard.*) の record を PDS (ds.jgs.me) から取り込む
// ための定数。zet と同じ PDS なので DID は ZET_DID を共有する。
import { ZET_DID } from "./zet";

export const STANDARD_DID = ZET_DID;

export const DOCUMENT_COLLECTION = "site.standard.document";
export const PUBLICATION_COLLECTION = "site.standard.publication";
export const PUBLICATION_RKEY = "3mz7iuy6k2222";
export const PUBLICATION_AT_URI = `at://${STANDARD_DID}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`;
export const PUBLICATION_URL = "https://w.jgs.me";
export const PUBLICATION_NAME = "I am Electrical machine";

// document.content.$type。HTML 記事の本体はこの型で持つ。
export const HTML_CONTENT_TYPE = "me.jgs.diary.html";

// copy.protocol。zet (atproto-zet) とも bsky 投稿 (atproto) とも混ぜない。
export const DOCUMENT_COPY_PROTOCOL = "atproto-document";

export function documentAtUri(rkey: string): string {
  return `at://${STANDARD_DID}/${DOCUMENT_COLLECTION}/${rkey}`;
}
