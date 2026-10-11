import { zetPageTitle, zetPath } from "@jigsaw/db/zet";
import { buildSbBody } from "./body";
import { extractLinks } from "./links";
import { firstImageURL } from "./firstImage";
import { SITE_URL } from "./site";
import {
  markBlobImages,
  parseZetAtUri,
  type FetchZetResult,
} from "./zetRecord";

// 取り込みの手順だけを持つ。D1 / R2 / PDS / ap / web への I/O は ZetDeps で
// 受け取る (linkIndex.ts の LinkIndexDeps と同じ形)。実装は zetStore.ts。

export type ZetTarget = {
  pageID: number;
  // zet.id。/z/<id> の purge に使う。
  zetID: number;
  bodyKey: string;
  cid: string | null;
};

export type ZetCreateInput = {
  pageTitle: string;
  rkey: string;
  bodyKey: string;
  created: string;
  image: string | null;
  date: string;
  zetTitle: string | null;
  atUri: string;
  cid: string;
  // object.atproto (getRecord のレスポンス原本)
  atproto: string;
  // object.mf2 (Micropub の通知そのもの)
  mf2: string;
  links: string[];
};

export type ZetUpdateInput = {
  pageID: number;
  updated: string;
  image: string | null;
  date: string;
  zetTitle: string | null;
  cid: string;
  atproto: string;
  mf2: string;
  links: string[];
};

export type ZetDeps = {
  getRecord: (rkey: string) => Promise<FetchZetResult>;
  findByAtUri: (atUri: string) => Promise<ZetTarget | null>;
  putBody: (bodyKey: string, body: string) => Promise<void>;
  // 書いた page.id を返す。
  create: (input: ZetCreateInput) => Promise<number>;
  update: (input: ZetUpdateInput) => Promise<void>;
  publish: (pageID: number, kind: "create" | "update") => Promise<void>;
  purge: (paths: string[]) => Promise<void>;
  newBodyKey: () => string;
  now: () => string;
};

export function zetURL(rkey: string): string {
  return `${SITE_URL}${zetPath(rkey)}`;
}

function fail(status: number, description: string): Response {
  return Response.json(
    {
      error: status >= 500 ? "server_error" : "invalid_request",
      error_description: description,
    },
    { status },
  );
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// 失敗しても取り込みは成功させる (micropub.ts の create / update と同じ判断)。
// ただし再送では直せない: 同じ CID の再送は取り込み済みとして publish せずに
// 返るため、配送・purge に失敗した zet は再送しても配送されない。
// 復旧は /internal/publish を手で叩く。
async function bestEffort(
  label: string,
  f: () => Promise<void>,
): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.error(`[zet] ${label} failed ${message(e)}`);
  }
}

export async function ingestZet(
  payload: unknown,
  deps: ZetDeps,
): Promise<Response> {
  let ref;
  try {
    ref = parseZetAtUri(payload);
  } catch (e) {
    return fail(400, message(e));
  }

  const got = await deps.getRecord(ref.rkey);
  if (!got.ok) return fail(got.status, got.description);
  if (got.zet.uri !== ref.atUri) {
    return fail(502, `pds returned another record: ${got.zet.uri}`);
  }
  const { record, cid, raw } = got.zet;

  const pageTitle = zetPageTitle(ref.rkey);
  const text = markBlobImages(record.text);
  // 1 行目が題 (body.ts)。読み側は先頭を題として捨てる。
  const body = buildSbBody(pageTitle, text);
  const links = extractLinks(body);
  const image = firstImageURL(text);
  const mf2 = JSON.stringify(payload);
  const location = zetURL(ref.rkey);

  // create / update は action ではなく copy 表で決める (spec)。
  const existing = await deps.findByAtUri(ref.atUri);

  if (existing) {
    // 同じ CID = 同じ record の再送。書き直すと publish が Webmention を
    // 再送するので何もしない。
    if (existing.cid === cid) {
      return new Response(null, {
        status: 200,
        headers: { Location: location },
      });
    }
    try {
      await deps.putBody(existing.bodyKey, body);
      await deps.update({
        pageID: existing.pageID,
        updated: deps.now(),
        image,
        date: record.date,
        zetTitle: record.title,
        cid,
        atproto: raw,
        mf2,
        links,
      });
    } catch (e) {
      console.error(`[zet] update failed rkey=${ref.rkey} ${message(e)}`);
      return fail(500, "failed to store zet");
    }
    // 一覧・個別 (/pages/zet%3A<rkey>)・share URL。micropub.ts の update と同じく
    // /p/<id> も消す。/z/<id> は zet の permalink。
    await bestEffort("purge", () =>
      deps.purge([
        "/zets",
        zetPath(ref.rkey),
        `/p/${existing.pageID}`,
        `/z/${existing.zetID}`,
      ]),
    );
    await bestEffort("publish", () => deps.publish(existing.pageID, "update"));
    return new Response(null, { status: 200, headers: { Location: location } });
  }

  // 本文を先に R2 へ書く。page 行が指す先を必ず存在させる (micropub.ts と同じ)。
  // D1 が失敗したら参照されない R2 オブジェクトが残るだけ。
  const bodyKey = deps.newBodyKey();
  let pageID: number;
  try {
    await deps.putBody(bodyKey, body);
    pageID = await deps.create({
      pageTitle,
      rkey: ref.rkey,
      bodyKey,
      created: record.createdAt,
      image,
      date: record.date,
      zetTitle: record.title,
      atUri: ref.atUri,
      cid,
      atproto: raw,
      mf2,
      links,
    });
  } catch (e) {
    console.error(`[zet] create failed rkey=${ref.rkey} ${message(e)}`);
    return fail(500, "failed to store zet");
  }
  await bestEffort("purge", () => deps.purge(["/zets"]));
  await bestEffort("publish", () => deps.publish(pageID, "create"));
  return new Response(null, { status: 201, headers: { Location: location } });
}
