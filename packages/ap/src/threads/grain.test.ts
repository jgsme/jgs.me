import { describe, expect, it } from "vitest";
import {
  grainGalleryAtUri,
  grainGalleryUrl,
  hasGrainGallery,
  isGrainIndexed,
} from "./grain";

const RKEY = "3mya474kmbdtf";

describe("grainGalleryAtUri / grainGalleryUrl", () => {
  it("gallery の at-uri", () =>
    expect(grainGalleryAtUri(RKEY)).toBe(
      "at://did:web:ds.jgs.me/social.grain.gallery/3mya474kmbdtf",
    ));
  it("grain.social の gallery URL (DID はエンコードしない)", () =>
    expect(grainGalleryUrl(RKEY)).toBe(
      "https://grain.social/profile/did:web:ds.jgs.me/gallery/3mya474kmbdtf",
    ));
});

describe("hasGrainGallery", () => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status });
  it("PDS の getRecord を叩き、200 なら true", async () => {
    const seen: string[] = [];
    const uas: string[] = [];
    const ok = await hasGrainGallery(RKEY, async (u, init) => {
      seen.push(u);
      uas.push(new Headers(init?.headers).get("User-Agent") ?? "");
      return json({ uri: "x" }, 200);
    });
    expect(ok).toBe(true);
    expect(uas[0]).toContain("jgs-me/");
    const u = new URL(seen[0]!);
    expect(u.origin + u.pathname).toBe(
      "https://ds.jgs.me/xrpc/com.atproto.repo.getRecord",
    );
    expect(Object.fromEntries(u.searchParams)).toEqual({
      repo: "did:web:ds.jgs.me",
      collection: "social.grain.gallery",
      rkey: RKEY,
    });
  });
  it("400 RecordNotFound は false", async () =>
    expect(
      await hasGrainGallery(RKEY, async () =>
        json({ error: "RecordNotFound" }, 400),
      ),
    ).toBe(false));
  it("他の 400 / 502 / fetch の throw は判定できないので reject", async () => {
    await expect(
      hasGrainGallery(RKEY, async () => json({ error: "InvalidRequest" }, 400)),
    ).rejects.toThrow();
    await expect(
      hasGrainGallery(RKEY, async () => json({}, 502)),
    ).rejects.toThrow();
    await expect(
      hasGrainGallery(RKEY, async () => {
        throw new Error("net");
      }),
    ).rejects.toThrow();
  });
});

describe("isGrainIndexed", () => {
  const at = "at://did:web:ds.jgs.me/social.grain.gallery/3mya474kmbdtf";
  it("getGallery に at-uri を渡し、200 なら true", async () => {
    const seen: string[] = [];
    const uas: string[] = [];
    const ok = await isGrainIndexed(at, async (u, init) => {
      seen.push(u);
      uas.push(new Headers(init?.headers).get("User-Agent") ?? "");
      return new Response("{}", { status: 200 });
    });
    expect(ok).toBe(true);
    expect(uas[0]).toContain("jgs-me/");
    expect(seen[0]).toBe(
      "https://grain.social/xrpc/social.grain.unspecced.getGallery?gallery=" +
        encodeURIComponent(at),
    );
  });
  it("400 Gallery not found / 502 は false", async () => {
    for (const s of [400, 502])
      expect(
        await isGrainIndexed(
          at,
          async () =>
            new Response('{"error":"Gallery not found"}', { status: s }),
        ),
      ).toBe(false);
  });
  it("fetch が throw したら false", async () =>
    expect(
      await isGrainIndexed(at, async () => {
        throw new Error("net");
      }),
    ).toBe(false));
});
