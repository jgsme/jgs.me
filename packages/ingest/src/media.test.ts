import { describe, expect, it } from "vitest";
import { putMedia } from "./media";

type Put = {
  key: string;
  bytes: ArrayBuffer;
  options?: { httpMetadata?: { contentType?: string; cacheControl?: string } };
};

// putMedia が使うのは put だけ。必要な口だけ生やす。
function fakeBucket(): { bucket: R2Bucket; puts: Put[] } {
  const puts: Put[] = [];
  const bucket = {
    put: async (key: string, bytes: ArrayBuffer, options?: Put["options"]) => {
      puts.push({ key, bytes, options });
    },
  } as unknown as R2Bucket;
  return { bucket, puts };
}

const bytes = new TextEncoder().encode("hello").buffer as ArrayBuffer;
// echo -n hello | shasum -a 256
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("putMedia", () => {
  it("キーは内容の sha256 と Content-Type 由来の拡張子", async () => {
    const { bucket, puts } = fakeBucket();
    const key = await putMedia(bucket, bytes, "image/png");
    expect(key).toBe(`${HELLO_SHA256}.png`);
    expect(puts[0]!.key).toBe(`${HELLO_SHA256}.png`);
  });

  it("image/jpeg の拡張子は jpg", async () => {
    const { bucket } = fakeBucket();
    expect(await putMedia(bucket, bytes, "image/jpeg")).toBe(
      `${HELLO_SHA256}.jpg`,
    );
  });

  // content-addressed なので中身が変わらない。ブラウザとエッジに永久に焼く。
  it("immutable な cacheControl を付ける", async () => {
    const { bucket, puts } = fakeBucket();
    await putMedia(bucket, bytes, "image/png");
    expect(puts[0]!.options?.httpMetadata).toEqual({
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });
  });

  it("未対応の Content-Type は null を返して put しない", async () => {
    const { bucket, puts } = fakeBucket();
    expect(await putMedia(bucket, bytes, "application/pdf")).toBeNull();
    expect(puts).toHaveLength(0);
  });
});
