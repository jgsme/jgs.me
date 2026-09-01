import { MEDIA_BASE_URL, USER_AGENT } from "./config";
import { extForType, putMedia } from "@jigsaw/media";
import { MAX_REDIRECTS, guardURL } from "./urlguard";

// HTML 用の MAX_BODY_BYTES (1MB) とは別に持つ。og:image は 1200x630 の PNG で
// 1MB を超えることがあり、流用したままだとその手の画像が丸ごと落ちる。
export const MAX_IMAGE_BYTES = 2_000_000;

// 外部サイトの画像 (h-card の u-photo、og:image) を自分の R2 に取り込み、
// 公開 URL を返す。取れなければ null。相手の URL へのフォールバックはしない。
// 同じ反応欄に自前配信と外部直リンが混ざると、壊れ方も読者の IP の漏れ方も
// 二通りになる。
//
// リダイレクトは自前で追う。github.com/<user>.png のように CDN へ 302 する
// アバターは珍しくないが、自動追跡だと hop 先が guard を通らない
// (fetchSource と同じ理由・同じ形)。
export async function storeImage(
  url: string | null,
  bucket: R2Bucket,
): Promise<string | null> {
  if (!url) return null;

  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = guardURL(current);
    if (!guard.ok) return null;

    let res: Response;
    try {
      res = await fetch(guard.url.href, {
        redirect: "manual",
        headers: {
          Accept: "image/*",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) return null;
      current = new URL(loc, guard.url).href;
      continue;
    }

    if (!res.ok) return null;

    // "image/png; charset=binary" を送るサーバが実在する。
    const contentType = (res.headers.get("Content-Type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!extForType(contentType)) return null;

    // 申告が上限超えなら本文を読まずに降りる。
    const len = Number(res.headers.get("Content-Length") ?? "0");
    if (len > MAX_IMAGE_BYTES) return null;

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;

    const key = await putMedia(bucket, bytes, contentType);
    return key === null ? null : `${MEDIA_BASE_URL}/${key}`;
  }

  return null;
}
