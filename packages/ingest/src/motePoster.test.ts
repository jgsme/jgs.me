import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moteApiUrl, parseMoteUrl, type MoteRef } from "@jigsaw/db/mote";
import { resolveImage, motePosterResolver } from "./motePoster";
import type { FetchFn } from "./pdsRecord";

const RKEY = "3mzzs3sn3d22l";
const REF = parseMoteUrl(`https://mote.jgs.me/u/ds.jgs.me/${RKEY}`) as MoteRef;
const POSTER = `https://mote.jgs.me/v1/videos/did:web:ds.jgs.me/${RKEY}/poster`;
const R2 = "https://r2.jgs.me/abc.jpeg";

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
    expect(await resolver(REF)).toBe(R2);
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

  it("poster の無い mote は null で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () => json({ posterUrl: null }));
    expect(await resolver(REF)).toBeNull();
    expect(rehosted).toEqual([]);
  });

  it("posterUrl が mote 以外のホストなら null で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ posterUrl: "https://evil.example/poster.jpg" }),
    );
    expect(await resolver(REF)).toBeNull();
    expect(rehosted).toEqual([]);
  });

  it("posterUrl が文字列でなければ null で、rehost を呼ばない", async () => {
    const { resolver, rehosted } = setup(async () => json({ posterUrl: 42 }));
    expect(await resolver(REF)).toBeNull();
    expect(rehosted).toEqual([]);
  });

  it("origin が前方一致するだけのホストは弾く", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ posterUrl: "https://mote.jgs.me.evil.example/p" }),
    );
    expect(await resolver(REF)).toBeNull();
    expect(rehosted).toEqual([]);
  });

  it("JSON が 404 なら null", async () => {
    const { resolver, rehosted } = setup(async () =>
      json({ error: "gone" }, 404),
    );
    expect(await resolver(REF)).toBeNull();
    expect(rehosted).toEqual([]);
  });

  it("JSON が壊れていても null", async () => {
    const { resolver } = setup(async () => new Response("not json"));
    expect(await resolver(REF)).toBeNull();
  });

  it("fetch が throw しても null", async () => {
    const { resolver } = setup(async () => {
      throw new Error("network");
    });
    expect(await resolver(REF)).toBeNull();
  });

  it("rehost が null を返したら null", async () => {
    const { resolver } = setup(
      async () => json({ posterUrl: POSTER }),
      async () => null,
    );
    expect(await resolver(REF)).toBeNull();
  });

  it("rehost が throw しても null", async () => {
    const { resolver } = setup(
      async () => json({ posterUrl: POSTER }),
      async () => {
        throw new Error("r2 down");
      },
    );
    expect(await resolver(REF)).toBeNull();
  });
});

describe("resolveImage", () => {
  const MOTE_BODY = `見て\n[https://mote.jgs.me/u/ds.jgs.me/${RKEY}]`;

  it("画像があれば mote を見ない", async () => {
    const motePoster = vi.fn(async () => R2);
    expect(await resolveImage("https://x/a.png", MOTE_BODY, motePoster)).toBe(
      "https://x/a.png",
    );
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("画像が無く mote があれば poster を返す", async () => {
    const motePoster = vi.fn(async () => R2);
    expect(await resolveImage(null, MOTE_BODY, motePoster)).toBe(R2);
    expect(motePoster).toHaveBeenCalledWith(REF);
  });

  it("画像も mote も無ければ null", async () => {
    const motePoster = vi.fn(async () => R2);
    expect(await resolveImage(null, "ただの本文", motePoster)).toBeNull();
    expect(motePoster).not.toHaveBeenCalled();
  });

  it("mote の poster が取れなければ null", async () => {
    expect(await resolveImage(null, MOTE_BODY, async () => null)).toBeNull();
  });
});
