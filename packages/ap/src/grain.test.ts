import { afterEach, describe, expect, it, vi } from "vitest";
import { findGrainGallery, grainURLForEmptyZet } from "./grain";

function stubFetch(res: () => Response): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    return res();
  });
  return urls;
}

const OK = 200;
const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findGrainGallery", () => {
  it("gallery の record があれば Grain の URL を返す", async () => {
    const urls = stubFetch(() => new Response("{}", { status: OK }));
    await expect(findGrainGallery("3mya6sf6fm2c2")).resolves.toBe(
      "https://grain.social/profile/ds.jgs.me/gallery/3mya6sf6fm2c2",
    );
    const u = new URL(urls[0]!);
    expect(u.origin + u.pathname).toBe(
      "https://ds.jgs.me/xrpc/com.atproto.repo.getRecord",
    );
    expect(u.searchParams.get("repo")).toBe("did:web:ds.jgs.me");
    expect(u.searchParams.get("collection")).toBe("social.grain.gallery");
    expect(u.searchParams.get("rkey")).toBe("3mya6sf6fm2c2");
  });

  it("RecordNotFound なら null", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: "RecordNotFound" }), {
          status: BAD_REQUEST,
        }),
    );
    await expect(findGrainGallery("x")).resolves.toBeNull();
  });

  it("PDS の不調は throw する", async () => {
    stubFetch(() => new Response("", { status: BAD_GATEWAY }));
    await expect(findGrainGallery("x")).rejects.toThrow("502");
  });
});

describe("grainURLForEmptyZet", () => {
  it("zet でなければ PDS を見ない", async () => {
    const urls = stubFetch(() => new Response("{}"));
    await expect(grainURLForEmptyZet(null, "")).resolves.toBeNull();
    expect(urls).toHaveLength(0);
  });

  it("文字のある zet は PDS を見ない", async () => {
    const urls = stubFetch(() => new Response("{}"));
    await expect(grainURLForEmptyZet("r", "<p>あ</p>")).resolves.toBeNull();
    expect(urls).toHaveLength(0);
  });

  it("画像だけの zet は gallery を引く", async () => {
    stubFetch(() => new Response("{}"));
    await expect(
      grainURLForEmptyZet("r", '<p><img src="https://r2.jgs.me/a.jpg"></p>'),
    ).resolves.toBe("https://grain.social/profile/ds.jgs.me/gallery/r");
  });
});
