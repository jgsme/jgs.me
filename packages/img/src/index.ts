import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sharedImages } from "@jigsaw/db";
import { putMedia } from "@jigsaw/media";
import { isAuthorized } from "./auth";
import { renderPage, type SharedImageView } from "./page";
import { isUploadError, parseUpload } from "./upload";
import { storeUpload, type StoreDeps } from "./store";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

// id は内容の sha256。この形でないものは D1 を引くまでもなく無い。
const ID = /^[0-9a-f]{64}$/;

app.get("/health", (c) => c.text("ok"));

app.post("/api/images", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? null, c.env.IMG_TOKEN)) {
    return c.text("unauthorized", 401);
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
      await db.insert(sharedImages).values(row);
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
  if (!ID.test(id)) return c.notFound();

  // R2 のオブジェクトは消さない。キーが内容の sha256 なので、同じ画像が
  // micropub 由来や Gyazo 取り込み由来でも w-media に入っている可能性がある。
  // 消すと記事本文の <img> が壊れる。
  await drizzle(c.env.DB).delete(sharedImages).where(eq(sharedImages.id, id));

  return c.body(null, 204);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!ID.test(id)) return c.notFound();

  const [row] = await drizzle(c.env.DB)
    .select()
    .from(sharedImages)
    .where(eq(sharedImages.id, id))
    .limit(1);
  if (!row) return c.notFound();

  const view: SharedImageView = {
    id: row.id,
    ext: row.ext,
    sourceURL: row.sourceURL,
    sourceTitle: row.sourceTitle,
    width: row.width,
    height: row.height,
    created: row.created,
  };

  return c.html(renderPage(view), 200, {
    // unfurl する側が取りに来る。行は消えうるので immutable にはしない。
    "Cache-Control": "public, max-age=300",
  });
});

export default app;
