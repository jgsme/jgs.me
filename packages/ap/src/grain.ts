import { USER_AGENT } from "./config";
import { htmlToText } from "./text";

// 画像だけの zet は diary が Grain (grain.social) の gallery としても PDS に書く。
// gallery の rkey は zet の rkey と同じ。本文が空で SNS に流せないので、
// 代わりにこの gallery の URL を流す。
const PDS_URL = "https://ds.jgs.me";
const PDS_DID = "did:web:ds.jgs.me";
const GRAIN_HANDLE = "ds.jgs.me";
const GRAIN_GALLERY = "social.grain.gallery";
const STATUS_BAD_REQUEST = 400;

export function grainGalleryURL(rkey: string): string {
  return `https://grain.social/profile/${GRAIN_HANDLE}/gallery/${rkey}`;
}

// 寸法が取れない・1MB を超える画像を含む zet は Grain に出ないので、
// URL を組む前に gallery の record があるか確かめる。
// 無ければ null。PDS の不調は throw して queue の retry に任せる。
export async function findGrainGallery(rkey: string): Promise<string | null> {
  const u = new URL("/xrpc/com.atproto.repo.getRecord", PDS_URL);
  u.searchParams.set("repo", PDS_DID);
  u.searchParams.set("collection", GRAIN_GALLERY);
  u.searchParams.set("rkey", rkey);

  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (res.ok) return grainGalleryURL(rkey);

  // dirig は無い record を 400 RecordNotFound で返す。
  if (res.status === STATUS_BAD_REQUEST) {
    const err = (await res.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (err?.error === "RecordNotFound") return null;
  }
  throw new Error(`grain getRecord failed: ${res.status} rkey=${rkey}`);
}

// 本文が文字として空になる zet (画像だけ) なら Grain の URL を返す。
export async function grainURLForEmptyZet(
  zetRkey: string | null,
  html: string,
): Promise<string | null> {
  if (zetRkey === null || htmlToText(html) !== "") return null;
  return findGrainGallery(zetRkey);
}
