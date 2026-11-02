import { jstDate } from "@jigsaw/db/article-date";
import type { RenderedHtmlArticle } from "@jigsaw/db/html-article";
import { pagePath } from "@jigsaw/db/page-path";
import { buildSbBody } from "./body";
import { parseDocumentAtUri, type FetchDocumentResult } from "./documentRecord";
import { normalizeDerivedText, type HtmlConverter } from "./htmlConvert";
import { firstHttpsImage, renderHtmlArticle } from "./htmlRender";
import { bestEffort, fail, message } from "./ingestResponse";
import { SITE_URL } from "./site";

// site.standard.document (HTML article) の取り込みの手順だけを持つ。
// D1 / R2 / PDS / Workers AI / ap / web への I/O は DocumentDeps で受け取る
// (zet.ts の ZetDeps と同じ形)。実装は documentStore.ts。

export type DocumentTarget = {
  pageID: number;
  // druck.id。/d/<id> の purge に使う。
  druckID: number;
  // 今の page.title。改題で旧題のパスを purge するのに使う。
  title: string;
  bodyKey: string;
  cid: string | null;
};

export type DocumentWrite = {
  title: string;
  image: string | null;
  spoiler: boolean;
  cid: string;
  // object.atproto (getRecord のレスポンス原本)
  atproto: string;
  // object.mf2 (Micropub の通知そのもの)
  mf2: string;
};

export type DocumentCreateInput = DocumentWrite & {
  bodyKey: string;
  atUri: string;
  // record.publishedAt
  created: string;
  // record.updatedAt ?? record.publishedAt
  updated: string;
  // jstDate(record.publishedAt)
  date: string;
};

// updated は record.updatedAt ?? now()
export type DocumentUpdateInput = DocumentWrite & {
  pageID: number;
  updated: string;
};

// R2 に置く 4 つ。原本 HTML・組み直し・派生テキスト (.sb)・検索用 md。
export type DocumentBodies = {
  html: string;
  render: RenderedHtmlArticle;
  sb: string;
  md: string;
};

export type DocumentDeps = {
  getRecord: (rkey: string) => Promise<FetchDocumentResult>;
  findByAtUri: (atUri: string) => Promise<DocumentTarget | null>;
  findPageIDByTitle: (title: string) => Promise<number | null>;
  convert: HtmlConverter;
  putBodies: (bodyKey: string, bodies: DocumentBodies) => Promise<void>;
  create: (
    input: DocumentCreateInput,
  ) => Promise<{ pageID: number; druckID: number }>;
  update: (input: DocumentUpdateInput) => Promise<void>;
  publish: (pageID: number, kind: "create" | "update") => Promise<void>;
  purge: (paths: string[]) => Promise<void>;
  newBodyKey: () => string;
  now: () => string;
};

export function documentURL(title: string): string {
  return `${SITE_URL}${pagePath(title)}`;
}

export async function ingestDocument(
  payload: unknown,
  deps: DocumentDeps,
): Promise<Response> {
  let ref;
  try {
    ref = parseDocumentAtUri(payload);
  } catch (e) {
    return fail(400, message(e));
  }

  const got = await deps.getRecord(ref.rkey);
  if (!got.ok) return fail(got.status, got.description);
  if (got.got.uri !== ref.atUri) {
    return fail(502, `pds returned another record: ${got.got.uri}`);
  }
  const { record, cid, raw } = got.got;

  // create / update は action ではなく copy 表で決める (zet と同じ)。
  const existing = await deps.findByAtUri(ref.atUri);
  // 同じ CID = 同じ record の再送。書き直すと publish が配送し直すので何もしない。
  if (existing && existing.cid === cid) {
    return new Response(null, {
      status: 200,
      headers: { Location: documentURL(existing.title) },
    });
  }

  // page.title は UNIQUE。記事の URL は題から決まるので、別の page が持つ題は
  // 取れない。uniqueTitle で別名にすると record.path と食い違うので弾く。
  const holder = await deps.findPageIDByTitle(record.title);
  if (holder !== null && holder !== existing?.pageID) {
    return fail(409, `title already used: ${record.title}`, "conflict");
  }

  // 組み直しと派生テキストは書く前に全部作る。どれかが落ちたら何も書かない。
  const html = record.content.html;
  let render: RenderedHtmlArticle;
  try {
    render = renderHtmlArticle(html, {
      colorScheme: record.content.colorScheme,
    });
  } catch (e) {
    return fail(400, `failed to render html: ${message(e)}`);
  }
  let text: string;
  let md: string;
  try {
    [text, md] = await Promise.all([
      deps.convert.toText(html),
      deps.convert.toMarkdown(html),
    ]);
  } catch (e) {
    return fail(502, `failed to convert html: ${message(e)}`);
  }

  // 1 行目が題 (body.ts)。検索・日付解決・抜粋はこの .sb を読む。
  const sb = buildSbBody(record.title, normalizeDerivedText(text));
  const bodies: DocumentBodies = { html, render, sb, md };
  const spoiler = record.content.spoiler;
  // ネタバレの記事は画像もネタバレになりうるので、サムネと OG 画像に使わない。
  const image = spoiler ? null : firstHttpsImage(html);
  const write: DocumentWrite = {
    title: record.title,
    image,
    spoiler,
    cid,
    atproto: raw,
    mf2: JSON.stringify(payload),
  };
  const location = documentURL(record.title);

  if (existing) {
    try {
      // bodyKey は record の一生で変えない。同じキーに上書きする。
      await deps.putBodies(existing.bodyKey, bodies);
      await deps.update({
        ...write,
        pageID: existing.pageID,
        updated: record.updatedAt ?? deps.now(),
      });
    } catch (e) {
      console.error(`[document] update failed rkey=${ref.rkey} ${message(e)}`);
      return fail(500, "failed to store document");
    }
    // トップ・/druck・個別・share URL。micropub.ts の update と同じく /p/<id> も消す。
    // 改題なら旧題の URL も消す (web は無い題を 404 で返す)。
    const paths = [
      "/",
      `/p/${existing.pageID}`,
      pagePath(record.title),
      `/d/${existing.druckID}`,
      "/druck",
    ];
    if (existing.title !== record.title) paths.push(pagePath(existing.title));
    await bestEffort("[document] purge", () => deps.purge(paths));
    await bestEffort("[document] publish", () =>
      deps.publish(existing.pageID, "update"),
    );
    return new Response(null, { status: 200, headers: { Location: location } });
  }

  // 本文を先に R2 へ書く。page 行が指す先を必ず存在させる (micropub.ts と同じ)。
  // D1 が失敗したら参照されない R2 オブジェクトが残るだけ。
  const bodyKey = deps.newBodyKey();
  let pageID: number;
  try {
    await deps.putBodies(bodyKey, bodies);
    ({ pageID } = await deps.create({
      ...write,
      bodyKey,
      atUri: ref.atUri,
      created: record.publishedAt,
      updated: record.updatedAt ?? record.publishedAt,
      // publishedAt は parse 済みの ISO8601 なので null にならない。
      date: jstDate(record.publishedAt)!,
    }));
  } catch (e) {
    console.error(`[document] create failed rkey=${ref.rkey} ${message(e)}`);
    return fail(500, "failed to store document");
  }
  await bestEffort("[document] purge", () => deps.purge(["/", "/druck"]));
  await bestEffort("[document] publish", () => deps.publish(pageID, "create"));
  return new Response(null, { status: 201, headers: { Location: location } });
}
