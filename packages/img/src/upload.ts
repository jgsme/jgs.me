import { extForType } from "@jigsaw/media";
import { MAX_UPLOAD_BYTES } from "./config";

export interface ParsedUpload {
  bytes: ArrayBuffer;
  contentType: string;
  sourceURL: string | null;
  srcURL: string | null;
  sourceTitle: string | null;
  width: number | null;
  height: number | null;
}

export interface UploadError {
  // Hono の c.json にそのまま渡せるよう、取りうる値を型で固定する。
  status: 400 | 413 | 415;
  error: string;
  description: string;
}

export function isUploadError(v: ParsedUpload | UploadError): v is UploadError {
  return "status" in v;
}

function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === "string" && v !== "" ? v : null;
}

function num(form: FormData, key: string): number | null {
  const v = text(form, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// data: と blob: は D1 の行に入れない。前者は巨大になりうるし、後者は
// そのタブの中でしか意味がない。
function externalURL(form: FormData, key: string): string | null {
  const v = text(form, key);
  if (v === null) return null;
  return v.startsWith("data:") || v.startsWith("blob:") ? null : v;
}

export async function parseUpload(
  form: FormData,
): Promise<ParsedUpload | UploadError> {
  // workers-types の FormData.get は string | null と宣言されているが、
  // 実行時にファイルパートは File が返る。実体に合わせて広げ直し、
  // instanceof で本当に File かを確かめる。
  const file = form.get("image") as unknown as File | string | null;
  if (!(file instanceof File)) {
    return {
      status: 400,
      error: "invalid_request",
      description: "image part is required",
    };
  }

  // Content-Type のパラメータ (charset 等) を落として判定する。
  const contentType = file.type.split(";")[0]!.trim();
  if (!extForType(contentType)) {
    return {
      status: 415,
      error: "unsupported_media_type",
      description: `unsupported content type: ${contentType}`,
    };
  }

  // 本文を読む前に落とす。putMedia は ArrayBuffer を丸ごとメモリに載せるので、
  // 読んでから測ると 128MB 制限に踏み込む。
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      status: 413,
      error: "too_large",
      description: `max ${MAX_UPLOAD_BYTES} bytes`,
    };
  }

  return {
    bytes: await file.arrayBuffer(),
    contentType,
    sourceURL: externalURL(form, "sourceUrl"),
    srcURL: externalURL(form, "srcUrl"),
    sourceTitle: text(form, "sourceTitle"),
    width: num(form, "width"),
    height: num(form, "height"),
  };
}
