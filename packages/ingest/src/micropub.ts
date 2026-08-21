import { drizzle } from "drizzle-orm/d1";
import { pages } from "@jigsaw/db";
import { newMicropubBodyKey, r2KeyOf } from "@jigsaw/db/body-key";
import { isAuthorized } from "./auth";
import { parseEntry } from "./mf2";
import { sanitizeHtml } from "./sanitize";
import type { Env } from "./index";

const SITE_URL = "https://w.jgs.me";

function objectURI(pageID: number): string {
  return `${SITE_URL}/o/${pageID}`;
}

function articleURL(title: string): string {
  return `${SITE_URL}/pages/${encodeURIComponent(title)}`;
}

export async function handleMicropubCreate(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAuthorized(request.headers.get("Authorization"), env.MICROPUB_TOKEN)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_request", error_description: "invalid json" },
      { status: 400 },
    );
  }

  let entry;
  try {
    entry = parseEntry(payload);
  } catch (e) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  const body = await sanitizeHtml(entry.contentHtml);
  const created = entry.published || new Date().toISOString();

  // 本文を先に R2 へ書く。page 行が指す先を必ず存在させる (spec §6)。
  // 逆順だと「本文が引けない page」が生まれる。
  // R2 だけ書けて D1 が失敗した場合は、参照されない孤児オブジェクトが残るだけ。
  const bodyKey = newMicropubBodyKey();
  const r2Key = r2KeyOf(bodyKey);
  if (!r2Key) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  await env.R2.put(r2Key, body, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  const db = drizzle(env.DB);

  // page.id を採番してから article / object に使うため、
  // page の INSERT だけ先に実行する。
  const [page] = await db
    .insert(pages)
    .values({
      title: entry.name,
      bodyKey,
      created,
      updated: created,
    })
    .returning({ id: pages.id });

  if (!page) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  await env.DB.batch([
    env.DB.prepare("INSERT INTO article (pageID, created) VALUES (?, ?)").bind(
      page.id,
      created,
    ),
    env.DB.prepare(
      `INSERT INTO object (id, pageID, source_protocol, mf2, deleted, created, updated)
       VALUES (?, ?, 'web', ?, 0, ?, ?)`,
    ).bind(
      objectURI(page.id),
      page.id,
      JSON.stringify(payload),
      created,
      created,
    ),
  ]);

  // 公開したので ActivityPub のフォロワーへ配送する。
  // 失敗しても投入自体は成功させる (配送は後から再実行できる)。
  // Service Binding の fetch はホスト名を見ない。パスだけが ap に届く。
  try {
    await env.AP.fetch("https://ap.internal/internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageID: page.id, kind: "create" }),
    });
  } catch (e) {
    console.error(`[publish] failed pageID=${page.id} ${String(e)}`);
  }

  return new Response(null, {
    status: 201,
    headers: { Location: articleURL(entry.name) },
  });
}

export async function handleMicropubConfig(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAuthorized(request.headers.get("Authorization"), env.MICROPUB_TOKEN)) {
    return new Response("unauthorized", { status: 401 });
  }
  return Response.json({
    "media-endpoint": `${new URL(request.url).origin}/micropub/media`,
  });
}

// 拡張子は Content-Type から決める。クライアントのファイル名を信用しない。
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function handleMicropubMedia(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAuthorized(request.headers.get("Authorization"), env.MICROPUB_TOKEN)) {
    return new Response("unauthorized", { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "multipart/form-data required",
      },
      { status: 400 },
    );
  }

  // workers-types の FormData.get は string | null と宣言されているが、
  // 実行時にファイルパートは File が返る。型定義が実体に追いついていないだけなので、
  // ここで実体に合わせて広げ直し、instanceof で本当に File かを確かめる。
  const file = form.get("file") as unknown as File | string | null;
  if (!(file instanceof File)) {
    return Response.json(
      { error: "invalid_request", error_description: "file part is required" },
      { status: 400 },
    );
  }

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `unsupported content type: ${file.type}`,
      },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  // 内容から鍵を作る。同じ画像を二度上げても1つにまとまる。
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `${hex}.${ext}`;

  // 画像は本文とは別バケット (w-media)。
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: file.type },
  });

  return new Response(null, {
    status: 201,
    headers: { Location: `${env.MEDIA_BASE_URL}/${key}` },
  });
}
