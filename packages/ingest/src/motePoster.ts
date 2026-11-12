import {
  firstMoteUrl,
  moteApiUrl,
  MOTE_ORIGIN,
  type MoteRef,
} from "@jigsaw/db/mote";
import { message } from "./ingestResponse";
import type { FetchFn } from "./pdsRecord";
import { USER_AGENT, type RehostBlob } from "./zetBlob";

// mote の URL から、w-media に写した poster の URL を返す。
// poster が無い・取れない・写せないなら null。throw しない (サムネが付かない
// だけで、取り込みそのものを失敗させない)。
export type MotePoster = (ref: MoteRef) => Promise<string | null>;

const JSON_TIMEOUT_MS = 5000;

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
      if (!res.ok) {
        console.error(`[mote] ${ref.url} returned ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { posterUrl?: unknown } | null;
      const posterUrl = data?.posterUrl;
      if (typeof posterUrl !== "string") return null;
      // JSON は信用しない。mote 以外のホストは取りに行かない。
      if (new URL(posterUrl).origin !== MOTE_ORIGIN) {
        console.error(`[mote] ${ref.url} poster is not on mote: ${posterUrl}`);
        return null;
      }
      return await rehost(posterUrl);
    } catch (e) {
      console.error(`[mote] ${ref.url} ${message(e)}`);
      return null;
    }
  };
}

// 本文の画像があればそれ、無ければ最初の mote の poster、どちらも無ければ null。
export async function resolveImage(
  image: string | null,
  content: string,
  motePoster: MotePoster,
): Promise<string | null> {
  if (image) return image;
  const ref = firstMoteUrl(content);
  return ref ? motePoster(ref) : null;
}
