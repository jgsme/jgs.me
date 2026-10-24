import { describe, expect, it } from "vitest";
import { galleryAtUri, grainUrlFromMf2, isGrainIndexed } from "./grain";

const G =
  "https://grain.social/profile/did:web:ds.jgs.me/gallery/3mya474kmbdtf";
const mf2 = (props: unknown) =>
  JSON.stringify({ type: ["h-entry"], properties: props });

describe("grainUrlFromMf2", () => {
  it("syndication の grain.social の URL を返す", () =>
    expect(grainUrlFromMf2(mf2({ category: ["zet"], syndication: [G] }))).toBe(
      G,
    ));
  it("grain 以外が先にあっても grain を拾う", () =>
    expect(
      grainUrlFromMf2(mf2({ syndication: ["https://bsky.app/x", G] })),
    ).toBe(G));
  it("grain 以外しか無ければ null", () =>
    expect(
      grainUrlFromMf2(mf2({ syndication: ["https://bsky.app/x"] })),
    ).toBeNull());
  it("syndication が無い / 配列でない / 文字列でない要素", () => {
    expect(grainUrlFromMf2(mf2({ category: ["zet"] }))).toBeNull();
    expect(grainUrlFromMf2(mf2({ syndication: G }))).toBeNull();
    expect(grainUrlFromMf2(mf2({ syndication: [1, null] }))).toBeNull();
  });
  it("null と壊れた JSON は null", () => {
    expect(grainUrlFromMf2(null)).toBeNull();
    expect(grainUrlFromMf2("{")).toBeNull();
  });
});

describe("galleryAtUri", () => {
  it("DID の actor", () =>
    expect(galleryAtUri(G)).toBe(
      "at://did:web:ds.jgs.me/social.grain.gallery/3mya474kmbdtf",
    ));
  it("percent-encode された DID も戻す", () =>
    expect(
      galleryAtUri(
        "https://grain.social/profile/did%3Aweb%3Ads.jgs.me/gallery/3mya474kmbdtf",
      ),
    ).toBe("at://did:web:ds.jgs.me/social.grain.gallery/3mya474kmbdtf"));
  it("gallery でない URL は null", () => {
    expect(
      galleryAtUri("https://grain.social/profile/did:web:ds.jgs.me"),
    ).toBeNull();
    expect(
      galleryAtUri("https://grain.social/profile/x/story/3abc"),
    ).toBeNull();
    expect(
      galleryAtUri("https://evil.example/profile/x/gallery/3abc"),
    ).toBeNull();
  });
});

describe("isGrainIndexed", () => {
  const at = "at://did:web:ds.jgs.me/social.grain.gallery/3mya474kmbdtf";
  it("getGallery に at-uri を渡し、200 なら true", async () => {
    const seen: string[] = [];
    const ok = await isGrainIndexed(at, async (u) => {
      seen.push(u);
      return new Response("{}", { status: 200 });
    });
    expect(ok).toBe(true);
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
