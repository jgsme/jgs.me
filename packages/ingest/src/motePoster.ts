import {
  firstMoteUrl,
  moteApiUrl,
  MOTE_ORIGIN,
  type MoteRef,
} from "@jigsaw/db/mote";
import { pageImage } from "./firstImage";
import { message } from "./ingestResponse";
import type { Env } from "./index";
import type { Entry } from "./mf2";
import type { FetchFn } from "./pdsRecord";
import { rehosterWith, USER_AGENT, type RehostBlob } from "./zetBlob";

// mote の URL から、w-media に写した poster を引く。throw / reject しない。
// none: mote が無い (404) か poster が無い (posterUrl null)。確定した答え。
// unavailable: それ以外 (timeout・通信失敗・5xx・壊れた JSON・不正な origin・
// 写せなかった)。調べられなかっただけなので、呼び側は前の値を保てる。
export type MotePosterResult =
  | { readonly kind: "poster"; readonly url: string }
  | { readonly kind: "none" }
  | { readonly kind: "unavailable" };
export type MotePoster = (ref: MoteRef) => Promise<MotePosterResult>;

const JSON_TIMEOUT_MS = 5000;
const POSTER_TIMEOUT_MS = 10_000;

const UNAVAILABLE: MotePosterResult = { kind: "unavailable" };
const NONE: MotePosterResult = { kind: "none" };

export function motePosterResolver(
  fetchFn: FetchFn,
  rehost: RehostBlob,
): MotePoster {
  return async (ref) => {
    try {
      const res = await fetchFn(moteApiUrl(ref), {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
      });
      // 消えた mote は想定内。ログは出さない。
      if (res.status === 404) return NONE;
      if (!res.ok) {
        console.error(`[mote] ${ref.url} returned ${res.status}`);
        return UNAVAILABLE;
      }
      const data = (await res.json()) as { posterUrl?: unknown } | null;
      const posterUrl = data?.posterUrl;
      if (posterUrl === null) return NONE;
      if (typeof posterUrl !== "string") {
        console.error(`[mote] ${ref.url} posterUrl is not a string`);
        return UNAVAILABLE;
      }
      // JSON は信用しない。mote 以外のホストは取りに行かない。
      if (new URL(posterUrl).origin !== MOTE_ORIGIN) {
        console.error(`[mote] ${ref.url} poster is not on mote: ${posterUrl}`);
        return UNAVAILABLE;
      }
      const url = await rehost(posterUrl);
      if (url === null) {
        console.error(`[mote] ${ref.url} poster was not stored`);
        return UNAVAILABLE;
      }
      return { kind: "poster", url };
    } catch (e) {
      console.error(`[mote] ${ref.url} ${message(e)}`);
      return UNAVAILABLE;
    }
  };
}

// 実環境の組み立て。poster の取得にも制限時間を付ける。
export function motePosterFromEnv(env: Env): MotePoster {
  return motePosterResolver(
    (input, init) => fetch(input, init),
    rehosterWith(env, (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(POSTER_TIMEOUT_MS) }),
    ),
  );
}

// 本文の画像があればそれ、無ければ最初の mote の poster。
// mote が none なら null、unavailable なら previous (更新前の image) を残す。
export async function resolveImage(
  image: string | null,
  content: string,
  motePoster: MotePoster,
  previous: string | null = null,
): Promise<string | null> {
  if (image) return image;
  const ref = firstMoteUrl(content);
  if (!ref) return null;
  const r = await motePoster(ref);
  if (r.kind === "poster") return r.url;
  if (r.kind === "none") return null;
  return previous;
}

// article / clip の page.image。photo > 本文の画像 > mote の poster。
// previous は update 時に保存済みの image (create は null)。
export function articleImage(
  entry: Entry,
  previous: string | null,
  motePoster: MotePoster,
): Promise<string | null> {
  return resolveImage(pageImage(entry), entry.content, motePoster, previous);
}
