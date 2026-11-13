import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moteApiUrl, parseMoteUrl } from "@jigsaw/db/mote";
import { fetchMotes, parseMoteView } from "./mote";

const OK = {
  pageUrl: "https://mote.jgs.me/u/ds.jgs.me/3mzzs3sn3d22l",
  videoUrl:
    "https://mote.jgs.me/v1/videos/did:web:ds.jgs.me/3mzzs3sn3d22l/video.mp4",
  posterUrl:
    "https://mote.jgs.me/v1/videos/did:web:ds.jgs.me/3mzzs3sn3d22l/poster",
  aspectRatio: { width: 720, height: 1280 },
  playback: { autoplay: true, muted: true, loop: true },
  title: "t",
  alt: null,
  uri: "at://x",
  cid: "c",
};

const URL_A = "https://mote.jgs.me/u/ds.jgs.me/3mzzs3sn3d22l";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

describe("parseMoteView", () => {
  it("使う項目だけを取り出す", () => {
    expect(parseMoteView(OK)).toEqual({
      pageUrl: OK.pageUrl,
      videoUrl: OK.videoUrl,
      posterUrl: OK.posterUrl,
      aspectRatio: OK.aspectRatio,
      playback: OK.playback,
      title: "t",
      alt: null,
    });
  });

  it("未知の項目は通さない", () => {
    const out = parseMoteView({ ...OK, evil: "x" });
    expect(out).not.toHaveProperty("evil");
    expect(out).not.toHaveProperty("uri");
    expect(out).not.toHaveProperty("cid");
  });

  it("posterUrl と aspectRatio が null でも通る", () => {
    const out = parseMoteView({ ...OK, posterUrl: null, aspectRatio: null });
    expect(out?.posterUrl).toBeNull();
    expect(out?.aspectRatio).toBeNull();
  });

  it("autoplay なのに muted が false なら muted を true にする", () => {
    expect(
      parseMoteView({
        ...OK,
        playback: { autoplay: true, muted: false, loop: false },
      })?.playback.muted,
    ).toBe(true);
  });

  it("autoplay でなければ muted はそのまま", () => {
    expect(
      parseMoteView({
        ...OK,
        playback: { autoplay: false, muted: false, loop: false },
      })?.playback.muted,
    ).toBe(false);
  });

  it.each([
    ["1:100000", { width: 1, height: 100000 }],
    ["100000:1", { width: 100000, height: 1 }],
  ])("極端な aspectRatio (%s) は null にして view は残す", (_n, a) => {
    const out = parseMoteView({ ...OK, aspectRatio: a });
    expect(out).not.toBeNull();
    expect(out?.aspectRatio).toBeNull();
  });

  it.each([
    ["4:1", { width: 4, height: 1 }],
    ["1:4", { width: 1, height: 4 }],
  ])("境目の aspectRatio (%s) は残す", (_n, a) => {
    expect(parseMoteView({ ...OK, aspectRatio: a })?.aspectRatio).toEqual(a);
  });

  it.each([
    [
      "videoUrl が別のホスト",
      { ...OK, videoUrl: "https://evil.example/v.mp4" },
    ],
    ["videoUrl が javascript:", { ...OK, videoUrl: "javascript:alert(1)" }],
    ["pageUrl が別のホスト", { ...OK, pageUrl: "https://evil.example/" }],
    ["posterUrl が別のホスト", { ...OK, posterUrl: "http://mote.jgs.me/p" }],
    ["playback が無い", { ...OK, playback: undefined }],
    [
      "playback.autoplay が文字列",
      { ...OK, playback: { autoplay: "yes", muted: true, loop: true } },
    ],
    ["aspectRatio が 0", { ...OK, aspectRatio: { width: 0, height: 1 } }],
    [
      "videoUrl に user と password",
      { ...OK, videoUrl: "https://a:b@mote.jgs.me/x" },
    ],
    ["videoUrl に user", { ...OK, videoUrl: "https://a@mote.jgs.me/x" }],
    ["title が数値", { ...OK, title: 1 }],
    ["null", null],
  ])("形の違う JSON は null: %s", (_n, v) => {
    expect(parseMoteView(v)).toBeNull();
  });
});

describe("fetchMotes", () => {
  it("取れた mote を URL を key にして返す", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
      json(OK),
    );
    const out = await fetchMotes([URL_A], fetcher);
    expect(Object.keys(out)).toEqual([URL_A]);
    expect(out[URL_A].videoUrl).toBe(OK.videoUrl);
    const ref = parseMoteUrl(URL_A)!;
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [input, init] = fetcher.mock.calls[0];
    expect(input).toBe(moteApiUrl(ref));
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("404 の mote は結果に入らない", async () => {
    const out = await fetchMotes([URL_A], async () => json({}, 404));
    expect(out).toEqual({});
  });

  it("fetcher が throw した mote は結果に入らず、他の mote は入る", async () => {
    const urlB = "https://mote.jgs.me/u/ds.jgs.me/3mzzs3sn3d23l";
    const out = await fetchMotes([URL_A, urlB], async (input) => {
      if (input.endsWith("3mzzs3sn3d22l")) throw new Error("boom");
      return json(OK);
    });
    expect(Object.keys(out)).toEqual([urlB]);
  });

  it("JSON でない本文の mote は結果に入らない", async () => {
    const out = await fetchMotes(
      [URL_A],
      async () => new Response("<html>", { status: 200 }),
    );
    expect(out).toEqual({});
  });

  it("形の違う JSON の mote は結果に入らない", async () => {
    const out = await fetchMotes([URL_A], async () =>
      json({ ...OK, videoUrl: "https://evil.example/v.mp4" }),
    );
    expect(out).toEqual({});
  });

  it("同じ URL は 1 回だけ引く", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
      json(OK),
    );
    await fetchMotes([URL_A, URL_A, `${URL_A}/`], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("11 本目以降は引かない", async () => {
    const urls = Array.from(
      { length: 12 },
      (_, i) =>
        `https://mote.jgs.me/u/ds.jgs.me/3mzzs3sn3d2${"abcdefghijkl"[i]}2`,
    );
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
      json(OK),
    );
    await fetchMotes(urls, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(10);
  });

  it("mote でない URL は引かない", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
      json(OK),
    );
    const out = await fetchMotes(
      ["https://example.com/", "https://bsky.app/profile/a/post/b"],
      fetcher,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });
});
