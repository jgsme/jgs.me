import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { articles, clips, objects, pages } from "@jigsaw/db";
import { newSbBodyKey, r2KeyOf, bodyFormatOf } from "@jigsaw/db/body-key";
import { isAuthorized } from "./auth";
import { parseEntry, isClip } from "./mf2";
import { applyUpdate, parseUpdateAction } from "./mf2update";
import { buildSbBody } from "./body";
import { parseTargetURL } from "./target";
import { putMedia } from "./media";
import { uniqueTitle } from "./uniqueTitle";
import type { Env } from "./index";

const SITE_URL = "https://w.jgs.me";

function objectURI(pageID: number): string {
  return `${SITE_URL}/o/${pageID}`;
}

function articleURL(title: string): string {
  return `${SITE_URL}/pages/${encodeURIComponent(title)}`;
}

// purge に渡すのは site-relative なパス (web の parsePurgePaths が絶対 URL を弾く)。
function articlePath(title: string): string {
  return `/pages/${encodeURIComponent(title)}`;
}

export interface CreateR2Put {
  bodyKey: string;
  r2Key: string;
  body: string;
  contentType: string;
}

// create が R2 に書く内容 (key / body / contentType) をここで組み立てる。
// 1行目に題、2行目以降に本文という不変条件は buildSbBody が作る。
// handleMicropubCreate がこの関数を経由せず entry.content を直接
// env.R2.put に渡すよう書き換えると、この不変条件が壊れて本文の1行目が
// 黙って消える (spec が最大のリスクと呼ぶ箇所)。この関数を通すことで
// その配線をユニットテストで固定できる。
export function buildCreateR2Put(
  name: string,
  content: string,
): CreateR2Put | null {
  const bodyKey = newSbBodyKey();
  const r2Key = r2KeyOf(bodyKey);
  if (!r2Key) return null;
  return {
    bodyKey,
    r2Key,
    body: buildSbBody(name, content),
    contentType: "text/plain; charset=utf-8",
  };
}

// POST /micropub は action で分岐する。action が無ければ create (spec 既定)。
export async function handleMicropubPost(
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

  const action = (payload as { action?: unknown } | null)?.action;

  if (action === undefined || action === "create") {
    return handleMicropubCreate(payload, env);
  }
  if (action === "update") {
    return handleMicropubUpdate(payload, env);
  }
  // delete / undelete は未実装。黙って 200 を返すと消えたつもりにさせる。
  return Response.json(
    {
      error: "invalid_request",
      error_description: `unsupported action: ${String(action)}`,
    },
    { status: 400 },
  );
}

async function handleMicropubCreate(
  payload: unknown,
  env: Env,
): Promise<Response> {
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

  const created = entry.published || new Date().toISOString();
  const db = drizzle(env.DB);

  // 題が既に使われていたら suffix を付ける。page.title は
  // /pages/<title> の実キーなので、重複させると片方が引けなくなる。
  // R2 に書く本文の 1 行目もこの題なので、put より先に決める。
  const title = await uniqueTitle(db, entry.name);

  // 本文を先に R2 へ書く。page 行が指す先を必ず存在させる (spec §6)。
  // 逆順だと「本文が引けない page」が生まれる。
  // R2 だけ書けて D1 が失敗した場合は、参照されない孤児オブジェクトが残るだけ。
  const put = buildCreateR2Put(title, entry.content);
  if (!put) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  await env.R2.put(put.r2Key, put.body, {
    httpMetadata: { contentType: put.contentType },
  });

  // page.id を採番してから article / clip / object に使うため、
  // page の INSERT だけ先に実行する。
  const [page] = await db
    .insert(pages)
    .values({
      title,
      bodyKey: put.bodyKey,
      created,
      updated: created,
      // 一覧のサムネ。photo が無ければ null のまま。
      image: entry.photo,
    })
    .returning({ id: pages.id });

  if (!page) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  // clip は「記事にはしないが残す」枠。article と排他にする。
  const clip = isClip(entry.categories);

  // env.DB.batch (生 SQL) と db.batch (query builder) は混ぜられないので、
  // clip / article の分岐も含めて 3 件とも drizzle で組み立てる。
  await db.batch([
    clip
      ? db.insert(clips).values({ pageID: page.id, created })
      : db.insert(articles).values({ pageID: page.id, created }),
    db.insert(objects).values({
      id: objectURI(page.id),
      pageID: page.id,
      sourceProtocol: "web",
      mf2: JSON.stringify(payload),
      deleted: false,
      created,
      updated: created,
    }),
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
    headers: { Location: articleURL(title) },
  });
}

// 記事の URL から page を引く。/pages/<title> は題での検索になるので、
// 同題が 2 件以上あるときは黙って片方を書き換えず弾く。
async function resolveTarget(
  env: Env,
  url: string,
): Promise<
  | { ok: true; pageID: number; title: string; bodyKey: string }
  | { ok: false; status: number; description: string }
> {
  let target;
  try {
    target = parseTargetURL(url, SITE_URL);
  } catch (e) {
    return {
      ok: false,
      status: 400,
      description: e instanceof Error ? e.message : String(e),
    };
  }

  const db = drizzle(env.DB);
  const columns = {
    id: pages.id,
    title: pages.title,
    bodyKey: pages.bodyKey,
  };
  // 同題が 2 件以上あるかを知りたいので limit は 2。
  const results =
    target.kind === "page"
      ? await db
          .select(columns)
          .from(pages)
          .where(eq(pages.id, target.pageID))
          .limit(2)
      : target.kind === "article"
        ? await db
            .select(columns)
            .from(pages)
            .innerJoin(articles, eq(articles.pageID, pages.id))
            .where(eq(articles.id, target.articleID))
            .limit(2)
        : await db
            .select(columns)
            .from(pages)
            .where(eq(pages.title, target.title))
            .limit(2);

  if (results.length === 0) {
    return { ok: false, status: 404, description: `not found: ${url}` };
  }
  if (results.length > 1) {
    return {
      ok: false,
      status: 400,
      description: `url matches more than one page: ${url}`,
    };
  }

  const row = results[0]!;
  return { ok: true, pageID: row.id, title: row.title, bodyKey: row.bodyKey };
}

// 記事ページはエッジに載る (web の +server.ts)。消さないと
// 差し替えた本文も改題も TTL が切れるまで出てこない。
// 失敗しても update 自体は成功させる。
async function purge(env: Env, paths: string[]): Promise<void> {
  try {
    const res = await env.WEB.fetch("https://web.internal/internal/purge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PURGE_TOKEN}`,
      },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      console.error(`[purge] status=${res.status} paths=${paths.join(",")}`);
    }
  } catch (e) {
    console.error(`[purge] failed ${String(e)}`);
  }
}

async function handleMicropubUpdate(
  payload: unknown,
  env: Env,
): Promise<Response> {
  let action;
  try {
    action = parseUpdateAction(payload);
  } catch (e) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  const target = await resolveTarget(env, action.url);
  if (!target.ok) {
    return Response.json(
      { error: "invalid_request", error_description: target.description },
      { status: target.status },
    );
  }

  // 更新は保存してある mf2 を土台にする。R2 の .sb (Scrapbox 記法の生テキスト)
  // から properties は復元できない。
  const [stored] = await drizzle(env.DB)
    .select({ mf2: objects.mf2 })
    .from(objects)
    .where(
      and(eq(objects.pageID, target.pageID), eq(objects.sourceProtocol, "web")),
    )
    .limit(1);

  if (!stored?.mf2) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `page has no micropub source: ${action.url}`,
      },
      { status: 400 },
    );
  }

  let base: { type?: unknown; properties?: unknown };
  try {
    base = JSON.parse(stored.mf2);
  } catch {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const props =
    base.properties && typeof base.properties === "object"
      ? (base.properties as Record<string, unknown>)
      : {};

  const nextPayload = {
    ...base,
    type: ["h-entry"],
    properties: applyUpdate(props, action),
  };

  // 適用後がまだ記事として成立しているかを create と同じ関数で確かめる。
  // 題や本文を消す update をここで弾く。
  let entry;
  try {
    entry = parseEntry(nextPayload);
  } catch (e) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `update would break the entry: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 400 },
    );
  }

  // Micropub で作られていないページ (Scrapbox アーカイブ) を書き換えない。
  // .json のキーに Scrapbox 記法の生テキストを書き込むと本文が壊れる。
  if (bodyFormatOf(target.bodyKey) !== "micropub-sb") {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `page was not created via micropub: ${target.title}`,
      },
      { status: 400 },
    );
  }

  const r2Key = r2KeyOf(target.bodyKey);
  if (!r2Key) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  // 本文は同じキーに上書きする。読み側は R2 を直読みするので即座に入れ替わる。
  // 新しいキーを振ると、参照されない古いオブジェクトが残るだけで得が無い。
  // 1行目の題はマージ後の name で書き直す (改題に追随する)。
  const body = buildSbBody(entry.name, entry.content);
  await env.R2.put(r2Key, body, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE page SET title = ?, updated = ? WHERE id = ?").bind(
      entry.name,
      now,
      target.pageID,
    ),
    env.DB.prepare("UPDATE object SET mf2 = ?, updated = ? WHERE id = ?").bind(
      JSON.stringify(nextPayload),
      now,
      objectURI(target.pageID),
    ),
  ]);

  const renamed = entry.name !== target.title;

  // 配送は後から再実行できる。失敗しても更新自体は成功させる。
  try {
    await env.AP.fetch("https://ap.internal/internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageID: target.pageID, kind: "update" }),
    });
  } catch (e) {
    console.error(`[publish] failed pageID=${target.pageID} ${String(e)}`);
  }

  // 一覧 (/) は題を出すので、改題でなくても載せ替えが要る。
  const paths = ["/", `/p/${target.pageID}`, articlePath(entry.name)];
  if (renamed) {
    // 旧 URL は DB から引けなくなるが、キャッシュに残った本文は出続ける。
    paths.push(articlePath(target.title));
  }
  const [article] = await drizzle(env.DB)
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.pageID, target.pageID))
    .limit(1);
  if (article) paths.push(`/a/${article.id}`);

  await purge(env, paths);

  // 題が URL を決めるので、改題は URL の変更になる。
  // spec は URL が変わったら 201 と Location を返せと言っている。
  if (renamed) {
    return new Response(null, {
      status: 201,
      headers: { Location: articleURL(entry.name) },
    });
  }
  return new Response(null, { status: 204 });
}

// update するクライアントは、まず現在の値を引いてから差分を作る。
// GET /micropub?q=source&url=...&properties[]=name&properties[]=content
export async function handleMicropubSource(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAuthorized(request.headers.get("Authorization"), env.MICROPUB_TOKEN)) {
    return new Response("unauthorized", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const url = params.get("url");
  if (!url) {
    return Response.json(
      { error: "invalid_request", error_description: "url is required" },
      { status: 400 },
    );
  }

  const target = await resolveTarget(env, url);
  if (!target.ok) {
    return Response.json(
      { error: "invalid_request", error_description: target.description },
      { status: target.status },
    );
  }

  const [stored] = await drizzle(env.DB)
    .select({ mf2: objects.mf2 })
    .from(objects)
    .where(
      and(eq(objects.pageID, target.pageID), eq(objects.sourceProtocol, "web")),
    )
    .limit(1);

  if (!stored?.mf2) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `page has no micropub source: ${url}`,
      },
      { status: 400 },
    );
  }

  let base: { properties?: unknown };
  try {
    base = JSON.parse(stored.mf2);
  } catch {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const props =
    base.properties && typeof base.properties === "object"
      ? (base.properties as Record<string, unknown>)
      : {};

  // properties[] の指定があればその分だけ返す。無ければ全部返す。
  const wanted = params
    .getAll("properties[]")
    .concat(params.getAll("properties"));
  if (wanted.length === 0) {
    return Response.json({ type: ["h-entry"], properties: props });
  }

  const picked: Record<string, unknown> = {};
  for (const key of wanted) {
    if (key in props) picked[key] = props[key];
  }
  return Response.json({ properties: picked });
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

  const bytes = await file.arrayBuffer();
  const key = await putMedia(env.MEDIA, bytes, file.type);
  if (key === null) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `unsupported content type: ${file.type}`,
      },
      { status: 400 },
    );
  }

  return new Response(null, {
    status: 201,
    headers: { Location: `${env.MEDIA_BASE_URL}/${key}` },
  });
}
