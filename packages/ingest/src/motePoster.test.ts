import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "./mf2";
import type { Env } from "./index";
import { moteApiUrl, parseMoteUrl, type MoteRef } from "@jigsaw/db/mote";
import {
  articleImage,
  motePosterFromEnv,
  motePosterResolver,
  resolveImage,
  type MotePoster,
} from "./motePoster";
import type { FetchFn } from "./pdsRecord";

const RKEY = "3mzzs3sn3d22l";
const REF = parseMoteUrl(`https://mote.jgs.me/u/ds.jgs.me/${RKEY}`) as MoteRef;
const POSTER = `https://mote.jgs.me/v1/videos/did:web:ds.jgs.me/${RKEY}/poster`;
const R2 = "https://r2.jgs.me/abc.jpeg";
const UNAVAILABLE = { kind: "unavailable" } as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

function setup(
  res: () => Promise<Response>,
  rehostResult: () => Promise<string | null> = async () => R2,
) {
  const fetched: { url: string; init?: RequestInit }[] = [];
  const rehosted: string[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    fetched.push({ url, init });
    return res();
  };
  const resolver = motePosterResolver(fetchFn, async (url) => {
    rehosted.push(url);
    return rehostResult();
  });
  return { resolver, fetched, rehosted };
}

describe("motePosterResolver", () => {
  it("poster を w-media に写した URL を返す", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ posterUrl: POSTER }),
    );
    expect(await resolver(REF)).toEqual({ kind: "poster", url: R2 });
    expect(rehosted).toEqual([POSTER]);
  });

  it("JSON は moteApiUrl の URL を User-Agent と signal 付きで取る", async () => {
    const { resolver, fetched } = setup(async () =>
      json({ posterUrl: POSTER }),
    );
    await resolver(REF);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]!.url).toBe(moteApiUrl(REF));
    const headers = fetched[0]!.init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^jgs-me\//);
    expect(headers.Accept).toBe("application/json");
    expect(fetched[0]!.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("posterUrl が null の mote は none で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () => json({ posterUrl: null }));
    expect(await resolver(REF)).toEqual({ kind: "none" });
    expect(rehosted).toEqual([]);
  });

  it("JSON が 404 なら none", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ error: "gone" }, 404),
    );
    expect(await resolver(REF)).toEqual({ kind: "none" });
    expect(rehosted).toEqual([]);
  });

  it("404 はエラーとしてログに出さない", async () => {
    const { resolver } = setup(async () => json({}, 404));
    await resolver(REF);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("5xx は unavailable で、ログに出す", async () => {
    const { resolver } = setup(async () => json({}, 503));
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("posterUrl が mote 以外のホストなら unavailable で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ posterUrl: "https://evil.example/poster.jpg" }),
    );
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
    expect(rehosted).toEqual([]);
  });

  it("posterUrl が文字列でなければ unavailable で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () => json({ posterUrl: 42 }));
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
    expect(rehosted).toEqual([]);
  });

  it("origin が前方一致するだけのホストは弾く", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ posterUrl: "https://mote.jgs.me.evil.example/p" }),
    );
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
    expect(rehosted).toEqual([]);
  });

  it("JSON が壊れていたら unavailable", async () => {
    const { resolver } = setup(async () => new Response("not json"));
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
  });

  it("fetch が throw したら unavailable", async () => {
    const { resolver } = setup(async () => {
      throw new Error("network");
    });
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
  });

  it("rehost が null を返したら unavailable", async () => {
    const { resolver } = setup(
      async () => json({ posterUrl: POSTER }),
      async () => null,
    );
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
  });

  it("rehost が reject (timeout 相当) したら unavailable", async () => {
    const { resolver } = setup(
      async () => json({ posterUrl: POSTER }),
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    );
    expect(await resolver(REF)).toEqual(UNAVAILABLE);
  });
});

describe("motePosterFromEnv", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("poster の取得に AbortSignal を付けて fetch する", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === moteApiUrl(REF)) return json({ posterUrl: POSTER });
      return new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/jpeg" },
      });
    });
    const put = vi.fn(async () => "k.jpeg");
    const env = {
      MEDIA: { put },
      MEDIA_BASE_URL: "https://r2.jgs.me",
    } as unknown as Env;
    const r = await motePosterFromEnv(env)(REF);
    const poster = calls.find((c) => c.url === POSTER);
    expect(poster?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(r.kind).not.toBe("none");
  });
});

const posterOf =
  (url: string): MotePoster =>
  async () => ({
    kind: "poster",
    url,
  });
const noneP: MotePoster = async () => ({ kind: "none" });
const unavailableP: MotePoster = async () => UNAVAILABLE;

describe("resolveImage", () => {
  const MOTE_BODY = `見て\n[https://mote.jgs.me/u/ds.jgs.me/${RKEY}]`;

  it("画像があれば mote を見ない", async () => {
    const motePoster = vi.fn(posterOf(R2));
    expect(await resolveImage("https://x/a.png", MOTE_BODY, motePoster)).toBe(
      "https://x/a.png",
    );
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("画像が無く mote があれば poster を返す", async () => {
    const motePoster = vi.fn(posterOf(R2));
    expect(await resolveImage(null, MOTE_BODY, motePoster)).toBe(R2);
    expect(motePoster).toHaveBeenCalledWith(REF);
  });

  it("画像も mote も無ければ null で、previous も使わない", async () => {
    const motePoster = vi.fn(posterOf(R2));
    expect(
      await resolveImage(null, "ただの本文", motePoster, "https://old/p.jpeg"),
    ).toBeNull();
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("mote が none なら previous があっても null", async () => {
    expect(
      await resolveImage(null, MOTE_BODY, noneP, "https://old/p.jpeg"),
    ).toBeNull();
  });

  it("mote が unavailable なら previous を残す", async () => {
    expect(
      await resolveImage(null, MOTE_BODY, unavailableP, "https://old/p.jpeg"),
    ).toBe("https://old/p.jpeg");
  });

  it("mote が unavailable で previous が無ければ null", async () => {
    expect(await resolveImage(null, MOTE_BODY, unavailableP)).toBeNull();
  });

  it("本文に画像があれば previous より画像が勝つ", async () => {
    expect(
      await resolveImage(
        "https://x/a.png",
        MOTE_BODY,
        unavailableP,
        "https://old/p.jpeg",
      ),
    ).toBe("https://x/a.png");
  });
});

describe("articleImage", () => {
  const entry = (over: Partial<Entry> = {}) =>
    ({ content: "本文", photo: null, ...over }) as unknown as Entry;
  const MOTE_BODY = `[https://mote.jgs.me/u/ds.jgs.me/${RKEY}]`;

  it("photo が最優先で、mote を見ない", async () => {
    const motePoster = vi.fn(posterOf(R2));
    const e = entry({ photo: "https://x/photo.png", content: MOTE_BODY });
    expect(await articleImage(e, null, motePoster)).toBe("https://x/photo.png");
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("photo が無ければ本文の画像が勝ち、mote を見ない", async () => {
    const motePoster = vi.fn(posterOf(R2));
    const e = entry({ content: `[https://x/a.png]\n${MOTE_BODY}` });
    expect(await articleImage(e, null, motePoster)).toBe("https://x/a.png");
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("画像が無く mote があれば poster を使う", async () => {
    expect(
      await articleImage(entry({ content: MOTE_BODY }), null, posterOf(R2)),
    ).toBe(R2);
  });

  it("mote が無ければ null", async () => {
    expect(
      await articleImage(entry(), "https://old/p.jpeg", posterOf(R2)),
    ).toBeNull();
  });

  it("mote が unavailable なら previous を残す", async () => {
    expect(
      await articleImage(
        entry({ content: MOTE_BODY }),
        "https://old/p.jpeg",
        unavailableP,
      ),
    ).toBe("https://old/p.jpeg");
  });

  it("mote が none なら previous を捨てて null", async () => {
    expect(
      await articleImage(
        entry({ content: MOTE_BODY }),
        "https://old/p.jpeg",
        noneP,
      ),
    ).toBeNull();
  });

  it("create (previous が null) で unavailable なら null", async () => {
    expect(
      await articleImage(entry({ content: MOTE_BODY }), null, unavailableP),
    ).toBeNull();
  });
});
