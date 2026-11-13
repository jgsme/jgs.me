import { isMoteUrl, moteApiUrl, parseMoteUrl } from "@jigsaw/db/mote";

export interface MoteView {
  readonly pageUrl: string;
  readonly videoUrl: string;
  readonly posterUrl: string | null;
  readonly aspectRatio: {
    readonly width: number;
    readonly height: number;
  } | null;
  readonly playback: {
    readonly autoplay: boolean;
    readonly muted: boolean;
    readonly loop: boolean;
  };
  readonly title: string | null;
  readonly alt: string | null;
}

// key は正規化した mote のページ URL
export type Motes = Record<string, MoteView>;

const TIMEOUT_MS = 2000;
// 1ページで叩く上限。超えたぶんは普通のリンクのまま出す。
const MAX_PER_PAGE = 10;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// origin が mote.jgs.me の https URL (userinfo 無し) だけ通す。
function moteUrl(v: unknown): string | null {
  return isMoteUrl(v) ? new URL(v as string).toString() : null;
}

// これより細い・平たい比は枠を決めるのに使わない (幅や高さがほぼ 0 になる)。
// null にすると poster / 動画の寸法で決まる。
const MAX_RATIO = 4;

function stringOrNull(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : undefined;
}

// 第三者のコンテンツを含む JSON なので、使う項目だけを新しい object に写す。
// 形が違うものは全体を捨てる。
export function parseMoteView(json: unknown): MoteView | null {
  if (!isRecord(json)) return null;

  const pageUrl = moteUrl(json.pageUrl);
  const videoUrl = moteUrl(json.videoUrl);
  if (pageUrl === null || videoUrl === null) return null;

  let posterUrl: string | null = null;
  if (json.posterUrl !== null && json.posterUrl !== undefined) {
    posterUrl = moteUrl(json.posterUrl);
    if (posterUrl === null) return null;
  }

  let aspectRatio: MoteView["aspectRatio"] = null;
  if (json.aspectRatio !== null && json.aspectRatio !== undefined) {
    const a = json.aspectRatio;
    if (
      !isRecord(a) ||
      !Number.isInteger(a.width) ||
      !Number.isInteger(a.height) ||
      (a.width as number) < 1 ||
      (a.height as number) < 1
    ) {
      return null;
    }
    const width = a.width as number;
    const height = a.height as number;
    const r = width / height;
    if (r >= 1 / MAX_RATIO && r <= MAX_RATIO) aspectRatio = { width, height };
  }

  const p = json.playback;
  if (
    !isRecord(p) ||
    typeof p.autoplay !== "boolean" ||
    typeof p.muted !== "boolean" ||
    typeof p.loop !== "boolean"
  ) {
    return null;
  }

  const title = stringOrNull(json.title);
  const alt = stringOrNull(json.alt);
  if (title === undefined || alt === undefined) return null;

  return {
    pageUrl,
    videoUrl,
    posterUrl,
    aspectRatio,
    // 音あり自動再生はブラウザが止めるので、autoplay なら muted にする。
    playback: {
      autoplay: p.autoplay,
      muted: p.autoplay || p.muted,
      loop: p.loop,
    },
    title,
    alt,
  };
}

async function fetchOne(
  ref: NonNullable<ReturnType<typeof parseMoteUrl>>,
  fetcher: Fetcher,
): Promise<MoteView | null> {
  const res = await fetcher(moteApiUrl(ref), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.log(`[mote] ${res.status} ${ref.url}`);
    return null;
  }
  const view = parseMoteView(await res.json());
  if (!view) console.log(`[mote] invalid ${ref.url}`);
  return view;
}

// 失敗した URL は結果に入らない。ScrapboxNode は普通のリンクとして出す。
export async function fetchMotes(
  urls: string[],
  fetcher: Fetcher = fetch,
): Promise<Motes> {
  const refs = new Map<string, NonNullable<ReturnType<typeof parseMoteUrl>>>();
  for (const url of urls) {
    const ref = parseMoteUrl(url);
    if (ref) refs.set(ref.url, ref);
  }
  const results = await Promise.all(
    [...refs.values()].slice(0, MAX_PER_PAGE).map(async (ref) => {
      try {
        return [ref.url, await fetchOne(ref, fetcher)] as const;
      } catch (e) {
        console.log(`[mote] error ${ref.url} ${String(e)}`);
        return [ref.url, null] as const;
      }
    }),
  );
  const out: Motes = {};
  for (const [url, view] of results) if (view) out[url] = view;
  return out;
}
