import { describe, expect, it } from "vitest";
import {
  buildCreateR2Put,
  handleMicropubMedia,
  handleMicropubPost,
} from "./micropub";
import type { Env } from "./index";

// handleMicropubCreate が R2 に書く内容 (body.test.ts / bodyKey.test.ts が別々に
// 保証している buildSbBody と r2KeyOf を、実際に create の配線でどう組み合わせて
// いるか) を固定する。誰かが handleMicropubCreate を書き換えて
// env.R2.put(r2Key, entry.content) のように buildSbBody を経由させなくしても、
// buildCreateR2Put 単体のテストだけでは検出できないが、handleMicropubCreate
// 側がこの関数を呼ばなくなったこと自体はレビューで目立つ変更になる。
// この不変条件 (1行目に題) が壊れると本文の1行目が黙って消える。
describe("buildCreateR2Put", () => {
  it("body の1行目が題、2行目以降が渡した content になる", () => {
    const put = buildCreateR2Put("題", "本文1\n本文2");
    expect(put).not.toBeNull();
    expect(put?.body).toBe("題\n本文1\n本文2");
    expect(put?.body.split("\n")[0]).toBe("題");
  });

  it("content が空でも題の行は残る", () => {
    const put = buildCreateR2Put("題", "");
    expect(put?.body).toBe("題\n");
  });

  it("bodyKey は sb- で始まり、r2Key はその .sb になる (micropub-sb 形式)", () => {
    const put = buildCreateR2Put("題", "本文");
    expect(put?.bodyKey.startsWith("sb-")).toBe(true);
    expect(put?.r2Key).toBe(`${put?.bodyKey}.sb`);
  });

  it("contentType は text/plain; charset=utf-8", () => {
    const put = buildCreateR2Put("題", "本文");
    expect(put?.contentType).toBe("text/plain; charset=utf-8");
  });

  it("呼ぶたびに bodyKey / r2Key が変わる", () => {
    const a = buildCreateR2Put("題", "本文");
    const b = buildCreateR2Put("題", "本文");
    expect(a?.bodyKey).not.toBe(b?.bodyKey);
  });
});

describe("handleMicropubPost: zet", () => {
  // at-uri の検証で落ちるので D1 にも PDS にも届かない。
  const env = { MICROPUB_TOKEN: "t", DB: {} } as unknown as Env;
  const post = (body: unknown) =>
    handleMicropubPost(
      new Request("https://ingest.example/micropub", {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      env,
    );

  it("category に zet があれば zet の取り込みに回す (name / content を要求しない)", async () => {
    const res = await post({
      type: ["h-entry"],
      properties: {
        category: ["zet"],
        "at-uri": ["at://did:web:example.com/me.jgs.diary.zet/3m2abcdefghij"],
      },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "invalid_request",
      error_description: expect.stringContaining("at-uri"),
    });
  });

  it("category に document があれば document の取り込みに回す", async () => {
    const res = await post({
      type: ["h-entry"],
      properties: {
        category: ["document"],
        "at-uri": ["at://did:web:ds.jgs.me/me.jgs.diary.zet/3m2abcdefghij"],
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error_description: string };
    expect(
      body.error_description.startsWith(
        "at-uri must be at://did:web:ds.jgs.me/site.standard.document/<rkey>:",
      ),
    ).toBe(true);
  });

  it("zet でなければ従来どおり記事として検証する", async () => {
    const res = await post({ type: ["h-entry"], properties: {} });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: "name is required",
    });
  });
});

describe("handleMicropubPost: draft", () => {
  // D1 に届く前に落ちる経路だけ。
  const env = { MICROPUB_TOKEN: "t", DB: {} } as unknown as Env;
  const post = (body: unknown) =>
    handleMicropubPost(
      new Request("https://ingest.example/micropub", {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      env,
    );
  const desc = async (res: Response) =>
    ((await res.json()) as { error_description: string }).error_description;

  it("post-status: draft の zet は 400", async () => {
    const res = await post({
      type: ["h-entry"],
      properties: {
        category: ["zet"],
        "at-uri": ["at://did:web:ds.jgs.me/me.jgs.diary.zet/3m2abcdefghij"],
        "post-status": ["draft"],
      },
    });
    expect(res.status).toBe(400);
    expect(await desc(res)).toContain("only an article can be a draft");
  });

  it("post-status: draft の document は 400", async () => {
    const res = await post({
      type: ["h-entry"],
      properties: {
        category: ["document"],
        "at-uri": [
          "at://did:web:ds.jgs.me/site.standard.document/3m2abcdefghij",
        ],
        "post-status": ["draft"],
      },
    });
    expect(res.status).toBe(400);
    expect(await desc(res)).toContain("only an article can be a draft");
  });

  it("post-status が読めない値の create は 400", async () => {
    const res = await post({
      type: ["h-entry"],
      properties: { name: ["題"], content: ["本文"], "post-status": ["private"] },
    });
    expect(res.status).toBe(400);
    expect(await desc(res)).toContain("post-status must be draft or published");
  });

  it("形の崩れた draft URL への update は 400", async () => {
    const res = await post({
      action: "update",
      url: "https://w.jgs.me/drafts/abc",
      replace: { name: ["改題"] },
    });
    expect(res.status).toBe(400);
    expect(await desc(res)).toContain("no valid draft key");
  });
});

describe("handleMicropubMedia", () => {
  const puts: { key: string; type?: string }[] = [];
  const env = {
    MICROPUB_TOKEN: "t",
    MEDIA_BASE_URL: "https://r2.example",
    MEDIA: {
      put: async (
        key: string,
        _b: ArrayBuffer,
        o?: { httpMetadata?: { contentType?: string } },
      ) => {
        puts.push({ key, type: o?.httpMetadata?.contentType });
      },
    },
  } as unknown as Env;

  function upload(type: string, body: string): Request {
    const form = new FormData();
    form.set("file", new File([body], "x", { type }));
    return new Request("https://w.example/micropub/media", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
      body: form,
    });
  }

  it("JSON を上げると 201 と .json の Location", async () => {
    const res = await handleMicropubMedia(
      upload("application/json", '{"body":"x"}'),
      env,
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toMatch(
      /^https:\/\/r2\.example\/[0-9a-f]{64}\.json$/,
    );
    expect(puts.at(-1)?.type).toBe("application/json");
  });

  it("画像は今までどおり", async () => {
    const res = await handleMicropubMedia(upload("image/png", "png"), env);
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toMatch(/\.png$/);
  });

  it("charset 付きの JSON は essence で判定し contentType は素の型で置く", async () => {
    const res = await handleMicropubMedia(
      upload("application/json;charset=utf-8", '{"body":"y"}'),
      env,
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toMatch(
      /^https:\/\/r2\.example\/[0-9a-f]{64}\.json$/,
    );
    expect(puts.at(-1)?.type).toBe("application/json");
  });

  it("image/png; foo=bar は png として受ける", async () => {
    const res = await handleMicropubMedia(
      upload("Image/PNG; foo=bar", "png2"),
      env,
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toMatch(/\.png$/);
    expect(puts.at(-1)?.type).toBe("image/png");
  });

  it("未対応の型は 400", async () => {
    const res = await handleMicropubMedia(upload("application/pdf", "x"), env);
    expect(res.status).toBe(400);
  });
});
