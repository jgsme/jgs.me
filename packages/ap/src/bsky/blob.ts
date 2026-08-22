import type { Env } from "../db";
import { ENTRYWAY, getSession } from "./session";

// app.bsky.embed.external#external.thumb の上限。
const MAX_THUMB_BYTES = 1_000_000;
const OG_BASE_URL = "https://og.w.jgs.me";
// blob は PDS 上で参照され続ける限り消えない。長めに持つ。
const CACHE_TTL = 60 * 60 * 24 * 365;

export type BlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

function ogURL(pageID: number): string {
  return `${OG_BASE_URL}/p/${pageID}.png`;
}

// blob ref をそのまま JSON で持つ。copy テーブルには入れない
// (あれは object.id → 他プロトコルの複製 URI 専用)。
function cacheKey(pageID: number): string {
  return `bsky:blob:${pageID}`;
}

export async function uploadOgThumb(
  pageID: number,
  env: Env,
): Promise<BlobRef | null> {
  // 同じ OG 画像を二度アップロードしない。
  const cached = await env.KV.get(cacheKey(pageID), "json");
  if (cached) return cached as BlobRef;

  const src = ogURL(pageID);
  const res = await fetch(src);
  if (!res.ok) {
    console.log(`[bsky] og fetch failed pageID=${pageID} status=${res.status}`);
    return null;
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_THUMB_BYTES) {
    // thumb は optional。上限を超えたら諦めて thumb 無しで投稿する。
    console.log(
      `[bsky] og too large pageID=${pageID} bytes=${bytes.byteLength}`,
    );
    return null;
  }

  const session = await getSession(env);
  const up = await fetch(`${ENTRYWAY}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "image/png",
    },
    body: bytes,
  });

  if (!up.ok) {
    console.error(`[bsky] uploadBlob failed status=${up.status}`);
    return null;
  }

  const body = (await up.json()) as { blob: BlobRef };
  const blob = body.blob;

  await env.KV.put(cacheKey(pageID), JSON.stringify(blob), {
    expirationTtl: CACHE_TTL,
  });

  console.log(`[bsky] uploadBlob ok pageID=${pageID} cid=${blob.ref.$link}`);
  return blob;
}
