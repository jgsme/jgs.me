import { describe, expect, it } from "vitest";
import { isUploadError, parseUpload } from "./upload";
import { MAX_UPLOAD_BYTES } from "./config";

function form(
  file: Blob | string | null,
  fields: Record<string, string> = {},
): FormData {
  const f = new FormData();
  if (file !== null) {
    if (typeof file === "string") f.append("image", file);
    else f.append("image", file, "a.png");
  }
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const PNG = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

describe("parseUpload", () => {
  it("画像とメタデータを取り出す", async () => {
    const r = await parseUpload(
      form(PNG(), {
        sourceUrl: "https://example.com/a",
        srcUrl: "https://example.com/a.png",
        sourceTitle: "題",
        width: "1200",
        height: "800",
      }),
    );

    expect(isUploadError(r)).toBe(false);
    if (isUploadError(r)) return;
    expect(r.contentType).toBe("image/png");
    expect(r.bytes.byteLength).toBe(3);
    expect(r.sourceURL).toBe("https://example.com/a");
    expect(r.srcURL).toBe("https://example.com/a.png");
    expect(r.sourceTitle).toBe("題");
    expect(r.width).toBe(1200);
    expect(r.height).toBe(800);
  });

  it("メタデータが無くても通る", async () => {
    const r = await parseUpload(form(PNG()));
    expect(isUploadError(r)).toBe(false);
    if (isUploadError(r)) return;
    expect(r.sourceURL).toBeNull();
    expect(r.width).toBeNull();
  });

  it("image パートが無ければ 400", async () => {
    const r = await parseUpload(form(null));
    expect(isUploadError(r)).toBe(true);
    if (!isUploadError(r)) return;
    expect(r.status).toBe(400);
  });

  it("image パートがファイルでなければ 400", async () => {
    const r = await parseUpload(form("ただの文字列"));
    expect(isUploadError(r)).toBe(true);
    if (!isUploadError(r)) return;
    expect(r.status).toBe(400);
  });

  // 自ドメインで配信する SVG はスクリプトを積める。
  it("未対応の Content-Type は 415", async () => {
    const svg = new Blob(["<svg/>"], { type: "image/svg+xml" });
    const r = await parseUpload(form(svg));
    expect(isUploadError(r)).toBe(true);
    if (!isUploadError(r)) return;
    expect(r.status).toBe(415);
  });

  // putMedia は ArrayBuffer を丸ごとメモリに載せる。読む前に落とす。
  it("上限を超えるサイズは 413", async () => {
    const big = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], {
      type: "image/png",
    });
    const r = await parseUpload(form(big));
    expect(isUploadError(r)).toBe(true);
    if (!isUploadError(r)) return;
    expect(r.status).toBe(413);
  });

  // "image/png; charset=x" のような申告を弾かない。
  it("Content-Type のパラメータを落として判定する", async () => {
    const b = new Blob([new Uint8Array([1])], {
      type: "image/png; charset=utf-8",
    });
    const r = await parseUpload(form(b));
    expect(isUploadError(r)).toBe(false);
    if (isUploadError(r)) return;
    expect(r.contentType).toBe("image/png");
  });

  it("width が数値でなければ null にする", async () => {
    const r = await parseUpload(form(PNG(), { width: "でかい" }));
    expect(isUploadError(r)).toBe(false);
    if (isUploadError(r)) return;
    expect(r.width).toBeNull();
  });

  // data: URL は巨大になりうる。D1 の行に入れない。
  it("srcUrl が data: なら保存しない", async () => {
    const r = await parseUpload(
      form(PNG(), { srcUrl: "data:image/png;base64,AAAA" }),
    );
    expect(isUploadError(r)).toBe(false);
    if (isUploadError(r)) return;
    expect(r.srcURL).toBeNull();
  });
});
