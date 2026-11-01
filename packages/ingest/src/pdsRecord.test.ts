import { describe, expect, it } from "vitest";
import { fetchPdsRecord, getRecordURL } from "./pdsRecord";

const RKEY = "3m2abcdefghij";
const parse = (v: unknown) => v as { a: number };

describe("getRecordURL", () => {
  it("collection と rkey を query に入れる", () => {
    expect(getRecordURL("x.y.z", RKEY)).toBe(
      `https://ds.jgs.me/xrpc/com.atproto.repo.getRecord?repo=did%3Aweb%3Ads.jgs.me&collection=x.y.z&rkey=${RKEY}`,
    );
  });
});

describe("fetchPdsRecord", () => {
  it("RecordNotFound は 400", async () => {
    const r = await fetchPdsRecord("x.y.z", RKEY, parse, async () =>
      Response.json({ error: "RecordNotFound" }, { status: 400 }),
    );
    expect(r).toEqual({
      ok: false,
      status: 400,
      description: `record not found: ${RKEY}`,
    });
  });
  it("fetch が投げたら 502", async () => {
    const r = await fetchPdsRecord("x.y.z", RKEY, parse, async () => {
      throw new Error("boom");
    });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(r.ok === false && r.description).toContain("pds unreachable");
  });
  it("500 は 502", async () => {
    const r = await fetchPdsRecord(
      "x.y.z",
      RKEY,
      parse,
      async () => new Response("", { status: 500 }),
    );
    expect(r).toEqual({
      ok: false,
      status: 502,
      description: "pds returned 500",
    });
  });
  it("uri / cid が無ければ 502", async () => {
    const r = await fetchPdsRecord("x.y.z", RKEY, parse, async () =>
      Response.json({ value: { a: 1 } }),
    );
    expect(r).toEqual({
      ok: false,
      status: 502,
      description: "pds response lacks uri/cid",
    });
  });
  it("成功時は raw に body を JSON.stringify で残す", async () => {
    const body = { uri: "at://x", cid: "bafy1", value: { a: 1 } };
    const r = await fetchPdsRecord("x.y.z", RKEY, parse, async () =>
      Response.json(body),
    );
    expect(r).toEqual({
      ok: true,
      got: {
        uri: "at://x",
        cid: "bafy1",
        record: { a: 1 },
        raw: JSON.stringify(body),
      },
    });
  });
});
