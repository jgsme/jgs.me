import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sharedImages } from "@jigsaw/db";
import { putMedia } from "@jigsaw/media";
import { isAuthorized } from "./auth";
import { MAX_UPLOAD_BYTES } from "./config";
import { isUploadError, parseUpload } from "./upload";
import { storeUpload, type StoreDeps } from "./store";
import type { Env } from "./env";

// 拡張が叩く API とヘルスチェック。個別ページ (/:id) は Vike が受けるので
// ここには無い。Vike を import しないので、この app は単体でテストできる。
const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text("ok"));

// API のエラーは JSON で返す契約なので、想定外の例外も JSON に揃える。
// 既定のハンドラは plain text を返し、拡張側がエラーの中身を出せなくなる。
// 401 (unauthorized) は各ハンドラが text で返しており、それは ingest の
// 既存慣習に揃えているのでここでは変えない。
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

app.post("/api/images", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? null, c.env.IMG_TOKEN)) {
    return c.text("unauthorized", 401);
  }

  // formData() はリクエストボディ全体をメモリに載せる。upload.ts の
  // MAX_UPLOAD_BYTES はその後にしか効かないので、宣言サイズの時点で落とす。
  // multipart のヘッダぶんの余裕を見る。Content-Length を送らない
  // chunked リクエストには効かないが、その場合も upload.ts 側で捕まる。
  const declared = Number(c.req.header("Content-Length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 4096) {
    return c.json(
      {
        error: "too_large",
        error_description: `max ${MAX_UPLOAD_BYTES} bytes`,
      },
      413,
    );
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json(
      {
        error: "invalid_request",
        error_description: "multipart/form-data required",
      },
      400,
    );
  }

  const parsed = await parseUpload(form);
  if (isUploadError(parsed)) {
    return c.json(
      { error: parsed.error, error_description: parsed.description },
      parsed.status,
    );
  }

  const db = drizzle(c.env.DB);
  const deps: StoreDeps = {
    exists: async (id) => {
      const rows = await db
        .select({ id: sharedImages.id })
        .from(sharedImages)
        .where(eq(sharedImages.id, id))
        .limit(1);
      return rows.length > 0;
    },
    put: (bytes, contentType) => putMedia(c.env.MEDIA, bytes, contentType),
    insert: async (row) => {
      // exists → insert は check-then-act なので、同じ画像の POST が重なると
      // 2 本目が PK 衝突する。行が既にあるなら何もしないのが正しい
      // (出典は最初の投稿のものを残す、という重複時の扱いと同じ)。
      await db.insert(sharedImages).values(row).onConflictDoNothing();
    },
  };

  const result = await storeUpload(parsed, deps);
  if (result === null) {
    return c.json(
      { error: "invalid_request", error_description: "could not store" },
      400,
    );
  }

  // 形は mira の POST /api/images に揃える。拡張の interpretResponse を
  // ターゲット間で共有するため。
  return result.duplicate
    ? c.json({ duplicate: true, record: { id: result.id } }, 200)
    : c.json({ record: { id: result.id } }, 201);
});

app.delete("/api/images/:id", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? null, c.env.IMG_TOKEN)) {
    return c.text("unauthorized", 401);
  }

  const id = c.req.param("id");
  if (!/^[0-9a-f]{64}$/.test(id)) return c.notFound();

  // R2 のオブジェクトは消さない。キーが内容の sha256 なので、同じ画像が
  // micropub 由来や Gyazo 取り込み由来でも w-media に入っている可能性がある。
  // 消すと記事本文の <img> が壊れる。
  await drizzle(c.env.DB).delete(sharedImages).where(eq(sharedImages.id, id));

  return c.body(null, 204);
});

export default app;
