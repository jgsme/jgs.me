import { draftPath } from "@jigsaw/db/draft";
import { buildSbBody } from "./body";
import { fail, message } from "./ingestResponse";
import { isClip, parseEntry } from "./mf2";
import { applyUpdate, type UpdateAction } from "./mf2update";
import { readPostStatus } from "./postStatus";
import { SITE_URL } from "./site";

// 下書き (draft 表) の create / update の手順だけを持つ。
// D1 / R2 / 配信への I/O は DraftDeps で受け取る (document.ts の DocumentDeps と同じ形)。
// 実装は draftStore.ts。

export type DraftRow = {
  id: number;
  key: string;
  title: string;
  bodyKey: string;
  mf2: string;
};

export type DraftPublishInput = {
  draftID: number;
  title: string;
  bodyKey: string;
  // 1 行目が題の .sb。page_link の抽出に使う。
  body: string;
  image: string | null;
  spoiler: boolean;
  // post-status を落とした payload の JSON
  mf2: string;
  // 公開した時刻 (ISO)
  created: string;
  // jstDate(created)
  date: string;
};

export type DraftDeps = {
  newKey: () => string;
  newBodyKey: () => string;
  now: () => string;
  putBody: (bodyKey: string, body: string) => Promise<void>;
  insert: (input: {
    key: string;
    title: string;
    bodyKey: string;
    spoiler: boolean;
    mf2: string;
    created: string;
  }) => Promise<void>;
  findByKey: (key: string) => Promise<DraftRow | null>;
  update: (input: {
    id: number;
    title: string;
    spoiler: boolean;
    mf2: string;
    updated: string;
  }) => Promise<void>;
  titleTaken: (title: string) => Promise<boolean>;
  // 作った pageID
  publish: (input: DraftPublishInput) => Promise<number>;
  putMd: (bodyKey: string, body: string) => Promise<void>;
  notify: (pageID: number) => Promise<void>;
};

export function draftURL(key: string): string {
  return `${SITE_URL}${draftPath(key)}`;
}

const CLIP_REJECTED = "a clip cannot be a draft";

export async function createDraft(
  payload: unknown,
  deps: DraftDeps,
): Promise<Response> {
  let entry;
  try {
    entry = parseEntry(payload);
  } catch (e) {
    return fail(400, message(e));
  }
  // clip は下書きを持たない (公開の経路が article 専用のため)。
  if (isClip(entry.categories)) return fail(400, CLIP_REJECTED);

  const key = deps.newKey();
  const bodyKey = deps.newBodyKey();
  // 本文を先に書く。行が指す先を必ず存在させる (逆順だと本文の無い行ができる)。
  await deps.putBody(bodyKey, buildSbBody(entry.name, entry.content));
  await deps.insert({
    key,
    title: entry.name,
    bodyKey,
    spoiler: entry.spoiler,
    // post-status: ["draft"] ごと残す。公開時に落とす。
    mf2: JSON.stringify(payload),
    created: deps.now(),
  });

  return new Response(null, {
    status: 201,
    headers: { Location: draftURL(key) },
  });
}

export async function updateDraft(
  action: UpdateAction,
  key: string,
  deps: DraftDeps,
): Promise<Response> {
  const row = await deps.findByKey(key);
  // 公開済みの下書きは行ごと消えるので、無い理由は区別できない。
  if (!row) return fail(404, "draft not found: it may already be published");

  // 更新は保存してある mf2 を土台にする (.sb から properties は復元できない)。
  let base: { type?: unknown; properties?: unknown };
  try {
    base = JSON.parse(row.mf2);
  } catch {
    return fail(500, "stored mf2 is broken");
  }
  const props =
    base.properties && typeof base.properties === "object"
      ? (base.properties as Record<string, unknown>)
      : {};
  const nextProps = applyUpdate(props, action);

  // 読めない値は 400。published への切り替え(公開)はまだ扱わない: 次の Task。
  try {
    readPostStatus(nextProps);
  } catch (e) {
    return fail(400, message(e));
  }

  // 適用後がまだ記事として成立しているかを create と同じ関数で確かめる。
  const next = { ...base, type: ["h-entry"], properties: nextProps };
  let entry;
  try {
    entry = parseEntry(next);
  } catch (e) {
    return fail(400, `update would break the entry: ${message(e)}`);
  }
  if (isClip(entry.categories)) return fail(400, CLIP_REJECTED);

  // 題は URL に入らない (鍵で引く) ので、改題の衝突確認は要らない。
  await deps.putBody(row.bodyKey, buildSbBody(entry.name, entry.content));
  await deps.update({
    id: row.id,
    title: entry.name,
    spoiler: entry.spoiler,
    mf2: JSON.stringify(next),
    updated: deps.now(),
  });

  return new Response(null, { status: 204 });
}
