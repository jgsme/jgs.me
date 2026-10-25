import { describe, expect, it, vi } from "vitest";
import { fetchOEmbeds, parseSpotify, sanitizeBluesky } from "./oembed";

const BSKY_HTML =
  '<blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:abc/app.bsky.feed.post/aaa" data-bluesky-cid="bafy"><p lang="ja">本文</p>&mdash; <a href="https://bsky.app/profile/did:plc:abc?ref_src=embed">jigsaw (@jgs.me)</a> <a href="https://bsky.app/profile/did:plc:abc/post/aaa?ref_src=embed">2026-10-01</a></blockquote><script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>';

const SPOTIFY_BODY = {
  html: '<iframe style="border-radius: 12px" width="100%" height="152" title="Spotify Embed: Song" frameborder="0" allowfullscreen allow="autoplay" loading="lazy" src="https://open.spotify.com/embed/track/xyz?utm_source=oembed"></iframe>',
  height: 152,
  title: "Song",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("sanitizeBluesky", () => {
  it("script を落として blockquote だけ残す", () => {
    const out = sanitizeBluesky(BSKY_HTML);
    expect(out).not.toContain("<script");
    expect(out?.startsWith('<blockquote class="bluesky-embed"')).toBe(true);
  });

  it("想定外の形は捨てる", () => {
    expect(sanitizeBluesky("<div>x</div>")).toBeNull();
    expect(
      sanitizeBluesky(
        '<blockquote class="bluesky-embed" data-bluesky-uri="at://x"><img src=x onerror=alert(1)></blockquote>',
      ),
    ).toBeNull();
  });
});

describe("parseSpotify", () => {
  it("src と高さを拾う", () => {
    expect(parseSpotify(SPOTIFY_BODY)).toEqual({
      src: "https://open.spotify.com/embed/track/xyz?utm_source=oembed",
      height: 152,
      title: "Song",
    });
  });

  it("別 origin の src は捨てる", () => {
    expect(
      parseSpotify({
        html: '<iframe src="https://evil.example/embed/x"></iframe>',
      }),
    ).toBeNull();
  });
});

describe("fetchOEmbeds", () => {
  it("provider ごとのエンドポイントを叩いて URL で引けるようにする", async () => {
    const fetcher = vi.fn(async (input: string) => {
      const u = new URL(input);
      if (u.hostname === "embed.bsky.app") return json({ html: BSKY_HTML });
      if (u.hostname === "open.spotify.com") return json(SPOTIFY_BODY);
      return json({}, 404);
    });
    const out = await fetchOEmbeds(
      [
        "https://bsky.app/profile/jgs.me/post/aaa",
        "https://open.spotify.com/track/xyz",
      ],
      fetcher,
    );
    expect(Object.keys(out)).toEqual([
      "https://bsky.app/profile/jgs.me/post/aaa",
      "https://open.spotify.com/track/xyz",
    ]);
    expect(out["https://bsky.app/profile/jgs.me/post/aaa"].provider).toBe(
      "bluesky",
    );
    const bskyCall = new URL(fetcher.mock.calls[0][0]);
    expect(bskyCall.searchParams.get("url")).toBe(
      "https://bsky.app/profile/jgs.me/post/aaa",
    );
  });

  it("失敗した URL は結果に入れない", async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input.includes("bsky")) throw new Error("timeout");
      return json({}, 500);
    });
    const out = await fetchOEmbeds(
      [
        "https://bsky.app/profile/jgs.me/post/aaa",
        "https://open.spotify.com/track/xyz",
      ],
      fetcher,
    );
    expect(out).toEqual({});
  });
});
