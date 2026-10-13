import { describe, expect, it, vi } from "vitest";
import {
  type FetchFn,
  fetchZetRecord,
  getRecordURL,
  isZetPayload,
  extractBlobURLs,
  markBlobImages,
  replaceBlobURLs,
  parseZetAtUri,
  parseZetRecordValue,
} from "./zetRecord";
import { firstImageURL } from "./firstImage";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`;
const BLOB =
  "https://ds.jgs.me/xrpc/com.atproto.sync.getBlob?did=did:web:ds.jgs.me&cid=bafkreiimg";

const payloadWith = (atUri: unknown) => ({
  type: ["h-entry"],
  properties: { category: ["zet"], "at-uri": [atUri] },
});

const value = (over: Record<string, unknown> = {}) => ({
  $type: "me.jgs.diary.zet",
  text: "今日の断片",
  date: "2026-10-11",
  createdAt: "2026-10-11T01:00:00.000Z",
  ...over,
});

const fakeFetch = (res: Response) => vi.fn<FetchFn>(async () => res);

describe("isZetPayload", () => {
  it("category に zet があれば true", () => {
    expect(isZetPayload(payloadWith(AT_URI))).toBe(true);
  });

  it("clip や記事は false", () => {
    expect(
      isZetPayload({ type: ["h-entry"], properties: { category: ["clip"] } }),
    ).toBe(false);
    expect(
      isZetPayload({ type: ["h-entry"], properties: { name: ["題"] } }),
    ).toBe(false);
  });

  it("properties が無い・null は false", () => {
    expect(isZetPayload({ action: "update" })).toBe(false);
    expect(isZetPayload(null)).toBe(false);
  });
});

describe("parseZetAtUri", () => {
  it("did:web:ds.jgs.me / me.jgs.diary.zet / TID を受ける", () => {
    expect(parseZetAtUri(payloadWith(AT_URI))).toEqual({
      atUri: AT_URI,
      rkey: RKEY,
    });
  });

  it("at-uri が無ければ throw", () => {
    expect(() =>
      parseZetAtUri({ type: ["h-entry"], properties: { category: ["zet"] } }),
    ).toThrow("at-uri is required");
  });

  it("別の DID は throw", () => {
    expect(() =>
      parseZetAtUri(
        payloadWith(`at://did:web:example.com/me.jgs.diary.zet/${RKEY}`),
      ),
    ).toThrow(/at-uri must be/);
  });

  it("別の collection は throw", () => {
    expect(() =>
      parseZetAtUri(
        payloadWith(`at://did:web:ds.jgs.me/app.bsky.feed.post/${RKEY}`),
      ),
    ).toThrow(/at-uri must be/);
  });

  it("TID でない rkey は throw", () => {
    expect(() => parseZetAtUri(payloadWith(`${AT_URI}/extra`))).toThrow(
      /not a TID/,
    );
    expect(() =>
      parseZetAtUri(payloadWith("at://did:web:ds.jgs.me/me.jgs.diary.zet/")),
    ).toThrow(/not a TID/);
    expect(() =>
      parseZetAtUri(
        payloadWith("at://did:web:ds.jgs.me/me.jgs.diary.zet/../../x"),
      ),
    ).toThrow(/not a TID/);
  });

  it("文字列でなければ throw", () => {
    expect(() => parseZetAtUri(payloadWith(42))).toThrow("at-uri is required");
  });
});

describe("parseZetRecordValue", () => {
  it("text / date / createdAt を読み、題が無ければ null", () => {
    expect(parseZetRecordValue(value())).toEqual({
      text: "今日の断片",
      title: null,
      date: "2026-10-11",
      createdAt: "2026-10-11T01:00:00.000Z",
    });
  });

  it("題があれば読む", () => {
    expect(parseZetRecordValue(value({ title: "朝の散歩" })).title).toBe(
      "朝の散歩",
    );
  });

  it("空白だけの題は null", () => {
    expect(parseZetRecordValue(value({ title: "  " })).title).toBeNull();
  });

  it("createdAt を ISO8601 UTC に正規化する", () => {
    expect(
      parseZetRecordValue(value({ createdAt: "2026-10-11T10:00:00+09:00" }))
        .createdAt,
    ).toBe("2026-10-11T01:00:00.000Z");
  });

  it("$type が違えば throw", () => {
    expect(() =>
      parseZetRecordValue(value({ $type: "app.bsky.feed.post" })),
    ).toThrow(/\$type/);
  });

  it("date が YYYY-MM-DD でなければ throw", () => {
    expect(() => parseZetRecordValue(value({ date: "2026/10/11" }))).toThrow(
      /date/,
    );
  });

  it("createdAt が読めなければ throw", () => {
    expect(() => parseZetRecordValue(value({ createdAt: "昨日" }))).toThrow(
      /createdAt/,
    );
  });

  // 空の zet を公開すると中身の無い Note が飛び、Threads は空本文で弾く。
  it("text が空白だけなら throw", () => {
    expect(() => parseZetRecordValue(value({ text: " \n " }))).toThrow(/text/);
  });

  it("title が文字列でなければ throw", () => {
    expect(() => parseZetRecordValue(value({ title: 1 }))).toThrow(/title/);
  });

  it("object でなければ throw", () => {
    expect(() => parseZetRecordValue(null)).toThrow(/object/);
  });
});

describe("getRecordURL", () => {
  it("無認証の com.atproto.repo.getRecord を指す", () => {
    expect(getRecordURL(RKEY)).toBe(
      `https://ds.jgs.me/xrpc/com.atproto.repo.getRecord?repo=did%3Aweb%3Ads.jgs.me&collection=me.jgs.diary.zet&rkey=${RKEY}`,
    );
  });
});

describe("fetchZetRecord", () => {
  it("200 なら uri / cid / record / 生の JSON を返す", async () => {
    const body = { uri: AT_URI, cid: "bafycid1", value: value() };
    const f = fakeFetch(Response.json(body));
    const got = await fetchZetRecord(RKEY, f);
    expect(f).toHaveBeenCalledWith(getRecordURL(RKEY), {
      headers: { Accept: "application/json" },
    });
    expect(got).toEqual({
      ok: true,
      zet: {
        uri: AT_URI,
        cid: "bafycid1",
        record: parseZetRecordValue(value()),
        raw: JSON.stringify(body),
      },
    });
  });

  it("RecordNotFound は 400", async () => {
    const f = fakeFetch(
      Response.json(
        { error: "RecordNotFound", message: "Could not locate record" },
        { status: 400 },
      ),
    );
    expect(await fetchZetRecord(RKEY, f)).toEqual({
      ok: false,
      status: 400,
      description: `record not found: ${RKEY}`,
    });
  });

  it("それ以外の 400 / 5xx は 502", async () => {
    expect(
      await fetchZetRecord(
        RKEY,
        fakeFetch(Response.json({ error: "InvalidRequest" }, { status: 400 })),
      ),
    ).toMatchObject({ ok: false, status: 502 });
    expect(
      await fetchZetRecord(RKEY, fakeFetch(new Response("", { status: 503 }))),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it("届かなければ 502", async () => {
    const f = vi.fn<FetchFn>(async () => {
      throw new Error("network down");
    });
    expect(await fetchZetRecord(RKEY, f)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it("uri / cid が無ければ 502", async () => {
    expect(
      await fetchZetRecord(RKEY, fakeFetch(Response.json({ value: value() }))),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it("body が object でなければ 502", async () => {
    for (const body of [null, [], 42, "x"]) {
      expect(
        await fetchZetRecord(RKEY, fakeFetch(Response.json(body))),
      ).toMatchObject({ ok: false, status: 502 });
    }
  });

  it("record が壊れていれば 400", async () => {
    const f = fakeFetch(
      Response.json({ uri: AT_URI, cid: "c", value: value({ date: "x" }) }),
    );
    expect(await fetchZetRecord(RKEY, f)).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});

describe("markBlobImages", () => {
  it("[getBlob URL] に #.png を足す", () => {
    expect(markBlobImages(`写真\n[${BLOB}]`)).toBe(`写真\n[${BLOB}#.png]`);
  });

  it("印を付けた URL を firstImageURL が画像として拾う", () => {
    expect(firstImageURL(`[${BLOB}]`)).toBeNull();
    expect(firstImageURL(markBlobImages(`[${BLOB}]`))).toBe(`${BLOB}#.png`);
  });

  it("[[getBlob URL]] (大きい画像) にも付ける", () => {
    expect(markBlobImages(`[[${BLOB}]]`)).toBe(`[[${BLOB}#.png]]`);
  });

  it("[画像 URL リンク URL] の画像側に付ける", () => {
    expect(markBlobImages(`[${BLOB} https://example.com]`)).toBe(
      `[${BLOB}#.png https://example.com]`,
    );
  });

  it("2 回通しても印は 1 つ", () => {
    const once = markBlobImages(`[${BLOB}]`);
    expect(markBlobImages(once)).toBe(once);
  });

  it("複数の画像に全部付ける", () => {
    const other = BLOB.replace("bafkreiimg", "bafkreiimg2");
    expect(markBlobImages(`[${BLOB}]\n[${other}]`)).toBe(
      `[${BLOB}#.png]\n[${other}#.png]`,
    );
  });

  it("ds.jgs.me の getBlob 以外は触らない", () => {
    const text =
      "[https://example.com/xrpc/com.atproto.sync.getBlob?cid=x] [https://ds.jgs.me/xrpc/other?x=1]";
    expect(markBlobImages(text)).toBe(text);
  });
});

describe("extractBlobURLs", () => {
  it("fragment を除いて重複なしで返す", () => {
    const other = BLOB.replace("bafkreiimg", "bafkreiimg2");
    expect(
      extractBlobURLs(`[${BLOB}]\n[[${BLOB}#.png]]\n[${other} https://x.test]`),
    ).toEqual([BLOB, other]);
  });

  it("ds.jgs.me の getBlob 以外は拾わない", () => {
    expect(
      extractBlobURLs(
        "[https://example.com/xrpc/com.atproto.sync.getBlob?cid=x]",
      ),
    ).toEqual([]);
  });
});

describe("replaceBlobURLs", () => {
  const R2 = "https://r2.jgs.me/abc.png";

  it("印ごと差し替える", () => {
    const resolved = new Map([[BLOB, R2]]);
    expect(replaceBlobURLs(`[${BLOB}#.png] [[${BLOB}]]`, resolved)).toBe(
      `[${R2}] [[${R2}]]`,
    );
  });

  it("対応の無い URL は残す", () => {
    const text = `[${BLOB}#.png]`;
    expect(replaceBlobURLs(text, new Map())).toBe(text);
  });
});
