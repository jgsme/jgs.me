import { ZET_DID } from "@jigsaw/db/zet";
import { USER_AGENT } from "../config";

const GALLERY_COLLECTION = "social.grain.gallery";

// diary は gallery を zet と同じ rkey で PDS に置く。rkey だけで at-uri と URL が決まる。
export function grainGalleryAtUri(rkey: string): string {
  return `at://${ZET_DID}/${GALLERY_COLLECTION}/${rkey}`;
}

// DID はエンコードしない (grain.social の URL は did:web:... のまま)。
export function grainGalleryUrl(rkey: string): string {
  return `https://grain.social/profile/${ZET_DID}/gallery/${rkey}`;
}

// Grain の AppView が gallery をまだ取り込んでいない間は、URL を投稿しても
// リンク先が 404 になる。待てば直るので、通常の失敗と区別して遅延 retry する。
export class GrainNotIndexedError extends Error {
  constructor(atUri: string) {
    super(`grain.social に gallery が取り込まれていない: ${atUri}`);
    this.name = "GrainNotIndexedError";
  }
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// getGallery が 200 を返したら取り込み済み。未取り込みは 400 (Gallery not found)、
// 一時障害は 502 などで返るので、200 以外とネットワーク失敗は全部「まだ」とみなす。
// Workers の fetch は素の参照を渡すと Illegal invocation になるのでラップする。
export async function isGrainIndexed(
  atUri: string,
  f: FetchFn = (i, init) => fetch(i, init),
): Promise<boolean> {
  try {
    const res = await f(
      `https://grain.social/xrpc/social.grain.unspecced.getGallery?gallery=${encodeURIComponent(atUri)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

// diary が Grain に gallery を出したかを PDS で確かめる。diary は Grain への書き込みを
// Micropub 通知より前に済ませるので、通知を受けた時点で record の有無は確定している。
// 無い record は 400 RecordNotFound (ingest の fetchZetRecord と同じ判定)。
// 判定できないとき (5xx・他の 400・通信失敗) に false へ倒すと、画像だけの zet が
// 本文空で二度と投稿されないので throw して queue の retry に任せる。
export async function hasGrainGallery(
  rkey: string,
  f: FetchFn = (i, init) => fetch(i, init),
): Promise<boolean> {
  const u = new URL("https://ds.jgs.me/xrpc/com.atproto.repo.getRecord");
  u.searchParams.set("repo", ZET_DID);
  u.searchParams.set("collection", GALLERY_COLLECTION);
  u.searchParams.set("rkey", rkey);
  const res = await f(u.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 200) return true;
  if (res.status === 400) {
    const err = (await res.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (err?.error === "RecordNotFound") return false;
  }
  throw new Error(`PDS の gallery 確認に失敗: ${res.status} (rkey=${rkey})`);
}
