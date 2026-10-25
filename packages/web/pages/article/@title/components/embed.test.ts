import { describe, expect, it } from "vitest";
import { parse } from "@progfay/scrapbox-parser";
import { collectOEmbedUrls, embedOf } from "./embed";

describe("embedOf", () => {
  it("YouTube は動画 ID を返す", () => {
    expect(embedOf("https://www.youtube.com/watch?v=Oh-r34rrM6c")).toEqual({
      kind: "youtube",
      videoId: "Oh-r34rrM6c",
    });
    expect(embedOf("https://youtu.be/abc")).toEqual({
      kind: "youtube",
      videoId: "abc",
    });
  });

  it("bsky の投稿 URL を正規化する", () => {
    expect(
      embedOf("https://bsky.app/profile/jgs.me/post/3l6oveex3ii2l/?foo=1"),
    ).toEqual({
      kind: "oembed",
      provider: "bluesky",
      url: "https://bsky.app/profile/jgs.me/post/3l6oveex3ii2l",
    });
  });

  it("bsky のプロフィールは対象外", () => {
    expect(embedOf("https://bsky.app/profile/jgs.me")).toBeNull();
  });

  it("Spotify は locale とクエリを剥がす", () => {
    expect(
      embedOf(
        "https://open.spotify.com/intl-ja/track/4uLU6hMCjMI75M1A2tKUQC?si=xyz",
      ),
    ).toEqual({
      kind: "oembed",
      provider: "spotify",
      url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    });
    expect(embedOf("https://open.spotify.com/album/1a2B3c")?.kind).toBe(
      "oembed",
    );
  });

  it("Spotify のトップやユーザーページは対象外", () => {
    expect(embedOf("https://open.spotify.com/")).toBeNull();
    expect(embedOf("https://open.spotify.com/user/foo")).toBeNull();
  });

  it("壊れた URL は null", () => {
    expect(embedOf("not a url")).toBeNull();
  });
});

describe("collectOEmbedUrls", () => {
  it("行・装飾の中から重複なしで集める", () => {
    const blocks = parse(
      [
        "title",
        "[https://bsky.app/profile/a.bsky.social/post/aaa]",
        "[* [https://open.spotify.com/track/xyz]]",
        "[https://bsky.app/profile/a.bsky.social/post/aaa]",
        "[https://www.youtube.com/watch?v=abc]",
      ].join("\n"),
    );
    expect(collectOEmbedUrls(blocks)).toEqual([
      "https://bsky.app/profile/a.bsky.social/post/aaa",
      "https://open.spotify.com/track/xyz",
    ]);
  });
});
