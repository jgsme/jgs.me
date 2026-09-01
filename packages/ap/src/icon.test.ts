import { afterEach, describe, expect, it, vi } from "vitest";
import { storeIcon } from "./icon";
import { MEDIA_BASE_URL, USER_AGENT } from "./config";

afterEach(() => {
  vi.unstubAllGlobals();
});

type Put = { key: string; contentType?: string };

function fakeBucket(): { bucket: R2Bucket; puts: Put[] } {
  const puts: Put[] = [];
  const bucket = {
    put: async (
      key: string,
      _bytes: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      puts.push({ key, contentType: options?.httpMetadata?.contentType });
    },
  } as unknown as R2Bucket;
  return { bucket, puts };
}

const PNG = new TextEncoder().encode("hello").buffer as ArrayBuffer;
// echo -n hello | shasum -a 256
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function imageResponse(type = "image/png", body: ArrayBuffer = PNG): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": type },
  });
}

describe("storeIcon", () => {
  it("画像を取って R2 に置き、r2 の URL を返す", async () => {
    const { bucket, puts } = fakeBucket();
    vi.stubGlobal("fetch", async () => imageResponse());

    const url = await storeIcon("https://ex.com/a.png", bucket);

    expect(url).toBe(`${MEDIA_BASE_URL}/${HELLO_SHA256}.png`);
    expect(puts).toEqual([
      { key: `${HELLO_SHA256}.png`, contentType: "image/png" },
    ]);
  });

  it("Content-Type のパラメータを落として判定する", async () => {
    const { bucket } = fakeBucket();
    vi.stubGlobal("fetch", async () => imageResponse("image/png; charset=x"));

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBe(
      `${MEDIA_BASE_URL}/${HELLO_SHA256}.png`,
    );
  });

  it("User-Agent を付けて取りに行く", async () => {
    const { bucket } = fakeBucket();
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      calls.push(init);
      return imageResponse();
    });

    await storeIcon("https://ex.com/a.png", bucket);

    const headers = calls[0]!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(USER_AGENT);
  });

  // github.com/<user>.png は avatars.githubusercontent.com へ 302 する。
  // 追わないと h-card の u-photo が丸ごと取れない。
  it("リダイレクトを追う", async () => {
    const { bucket } = fakeBucket();
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      seen.push(u);
      if (seen.length === 1) {
        return new Response("", {
          status: 302,
          headers: { Location: "https://cdn.example/a.png" },
        });
      }
      return imageResponse();
    });

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBe(
      `${MEDIA_BASE_URL}/${HELLO_SHA256}.png`,
    );
    expect(seen).toEqual(["https://ex.com/a.png", "https://cdn.example/a.png"]);
  });

  // 各 hop を再検査しないと、外部 URL からの 302 で内部へ潜られる。
  it("リダイレクト先が guard に弾かれたら null", async () => {
    const { bucket, puts } = fakeBucket();
    vi.stubGlobal("fetch", async () => {
      return new Response("", {
        status: 302,
        headers: { Location: "http://localhost/a.png" },
      });
    });

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it("url が null なら fetch しない", async () => {
    const { bucket } = fakeBucket();
    let called = false;
    vi.stubGlobal("fetch", async () => {
      called = true;
      return imageResponse();
    });

    expect(await storeIcon(null, bucket)).toBeNull();
    expect(called).toBe(false);
  });

  it("guard に弾かれる URL は fetch しない", async () => {
    const { bucket } = fakeBucket();
    let called = false;
    vi.stubGlobal("fetch", async () => {
      called = true;
      return imageResponse();
    });

    expect(await storeIcon("http://127.0.0.1/a.png", bucket)).toBeNull();
    expect(called).toBe(false);
  });

  it("画像でない Content-Type は置かない", async () => {
    const { bucket, puts } = fakeBucket();
    vi.stubGlobal("fetch", async () => imageResponse("text/html"));

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it("Content-Length が上限を超えていたら本文を読まない", async () => {
    const { bucket, puts } = fakeBucket();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(PNG, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Content-Length": "99999999",
          },
        }),
    );

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it("Content-Length が無くても実バイトが上限を超えたら置かない", async () => {
    const { bucket, puts } = fakeBucket();
    const big = new Uint8Array(1_000_001).buffer as ArrayBuffer;
    vi.stubGlobal("fetch", async () => imageResponse("image/png", big));

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it("応答が ok でなければ null", async () => {
    const { bucket } = fakeBucket();
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
  });

  // 名前解決できないホストで fetch は throw する。ここで握らないと
  // Queue の consumer が retry して死んだ URL に投げ直し続ける。
  it("fetch が throw しても null で返す", async () => {
    const { bucket } = fakeBucket();
    vi.stubGlobal("fetch", async () => {
      throw new Error("dns");
    });

    expect(await storeIcon("https://ex.com/a.png", bucket)).toBeNull();
  });
});
