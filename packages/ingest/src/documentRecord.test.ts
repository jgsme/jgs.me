import { describe, expect, it } from "vitest";
import {
  fetchDocumentRecord,
  isDocumentPayload,
  parseDocumentAtUri,
  parseDocumentRecordValue,
} from "./documentRecord";

const RKEY = "3m2abcdefghij";
const AT_URI = `at://did:web:ds.jgs.me/site.standard.document/${RKEY}`;
const valid = {
  $type: "site.standard.document",
  site: "at://did:web:ds.jgs.me/site.standard.publication/w.jgs.me",
  path: "/pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2",
  title: "部屋の CO2",
  publishedAt: "2026-10-31T03:00:00Z",
  content: { $type: "me.jgs.diary.html", html: "<p>x</p>" },
};

describe("document payload", () => {
  it("category に document があれば document の通知", () => {
    expect(
      isDocumentPayload({
        properties: { category: ["document"], "at-uri": [AT_URI] },
      }),
    ).toBe(true);
    expect(isDocumentPayload({ properties: { category: ["zet"] } })).toBe(
      false,
    );
  });
  it("at-uri から rkey を取る", () => {
    expect(parseDocumentAtUri({ properties: { "at-uri": [AT_URI] } })).toEqual({
      atUri: AT_URI,
      rkey: RKEY,
    });
  });
  it("zet の collection の at-uri は弾く", () => {
    expect(() =>
      parseDocumentAtUri({
        properties: {
          "at-uri": [`at://did:web:ds.jgs.me/me.jgs.diary.zet/${RKEY}`],
        },
      }),
    ).toThrow(
      "at-uri must be at://did:web:ds.jgs.me/site.standard.document/<rkey>",
    );
  });
  it("at-uri が無い・TID でない", () => {
    expect(() => parseDocumentAtUri({ properties: {} })).toThrow(
      "at-uri is required",
    );
    expect(() =>
      parseDocumentAtUri({
        properties: { "at-uri": [`${AT_URI.slice(0, -13)}x`] },
      }),
    ).toThrow("at-uri rkey is not a TID");
  });
});

describe("parseDocumentRecordValue", () => {
  it("正しい record を読む", () => {
    expect(parseDocumentRecordValue(valid)).toEqual({
      title: "部屋の CO2",
      path: "/pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2",
      publishedAt: "2026-10-31T03:00:00.000Z",
      updatedAt: null,
      content: {
        type: "html",
        html: "<p>x</p>",
        spoiler: false,
        colorScheme: null,
      },
    });
  });
  it("spoiler / updatedAt / colorScheme を読む", () => {
    const r = parseDocumentRecordValue({
      ...valid,
      updatedAt: "2026-11-01T00:00:00Z",
      content: { ...valid.content, spoiler: true, colorScheme: "light dark" },
    });
    expect(r.updatedAt).toBe("2026-11-01T00:00:00.000Z");
    expect(r.content).toMatchObject({
      spoiler: true,
      colorScheme: "light dark",
    });
  });
  it.each([
    [
      "$type 違い",
      { ...valid, $type: "x" },
      "record $type must be site.standard.document",
    ],
    [
      "site 違い",
      {
        ...valid,
        site: "at://did:web:ds.jgs.me/site.standard.publication/other",
      },
      "record site must be at://did:web:ds.jgs.me/site.standard.publication/w.jgs.me",
    ],
    [
      "題が空",
      { ...valid, title: " ", path: "/pages/%20" },
      "record title is required",
    ],
    [
      "題に改行",
      { ...valid, title: "a\nb", path: "/pages/a%0Ab" },
      "record title must be a single line without surrounding spaces",
    ],
    [
      "題の前後に空白",
      { ...valid, title: " a", path: "/pages/%20a" },
      "record title must be a single line without surrounding spaces",
    ],
    [
      "題が zet:",
      { ...valid, title: "zet:a", path: "/pages/zet%3Aa" },
      "record title must not start with zet:",
    ],
    [
      "path 違い",
      { ...valid, path: "/pages/x" },
      "record path must be /pages/%E9%83%A8%E5%B1%8B%E3%81%AE%20CO2",
    ],
    [
      "publishedAt が日時でない",
      { ...valid, publishedAt: "x" },
      "record publishedAt must be a datetime",
    ],
    [
      "updatedAt が日時でない",
      { ...valid, updatedAt: "x" },
      "record updatedAt must be a datetime",
    ],
    [
      "content が object でない",
      { ...valid, content: "x" },
      "record content must be an object",
    ],
    [
      "content の $type が未知",
      { ...valid, content: { $type: "me.jgs.diary.sb", text: "x" } },
      "unsupported content $type: me.jgs.diary.sb",
    ],
    [
      "html が空",
      { ...valid, content: { $type: "me.jgs.diary.html", html: "" } },
      "record content.html is required",
    ],
    [
      "spoiler が bool でない",
      { ...valid, content: { ...valid.content, spoiler: "yes" } },
      "record content.spoiler must be a boolean",
    ],
    [
      "colorScheme に CSS を混ぜる",
      {
        ...valid,
        content: { ...valid.content, colorScheme: "dark; background:url(x)" },
      },
      "record content.colorScheme is invalid",
    ],
    [
      "colorScheme が未知の語",
      { ...valid, content: { ...valid.content, colorScheme: "sepia" } },
      "record content.colorScheme is invalid",
    ],
  ])("%s は弾く", (_, value, message) => {
    expect(() => parseDocumentRecordValue(value)).toThrow(message);
  });
});

describe("fetchDocumentRecord", () => {
  it("getRecord は site.standard.document を引く", async () => {
    const urls: string[] = [];
    await fetchDocumentRecord(RKEY, async (u) => {
      urls.push(u);
      return Response.json({ uri: AT_URI, cid: "bafy1", value: valid });
    });
    expect(urls[0]).toBe(
      `https://ds.jgs.me/xrpc/com.atproto.repo.getRecord?repo=did%3Aweb%3Ads.jgs.me&collection=site.standard.document&rkey=${RKEY}`,
    );
  });
  it("壊れた record は 400 invalid record", async () => {
    const r = await fetchDocumentRecord(RKEY, async () =>
      Response.json({
        uri: AT_URI,
        cid: "bafy1",
        value: { ...valid, $type: "x" },
      }),
    );
    expect(r).toEqual({
      ok: false,
      status: 400,
      description:
        "invalid record: record $type must be site.standard.document",
    });
  });
});
