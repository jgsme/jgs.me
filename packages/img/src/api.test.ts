import { describe, expect, it } from "vitest";
import app from "./api";

describe("api", () => {
  it("/health は ok を返す", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("トークン無しの POST /api/images は 401", async () => {
    const res = await app.request(
      "/api/images",
      { method: "POST", body: new FormData() },
      { IMG_TOKEN: "secret" },
    );
    expect(res.status).toBe(401);
  });

  it("トークン無しの DELETE は 401", async () => {
    const res = await app.request(
      `/api/images/${"a".repeat(64)}`,
      { method: "DELETE" },
      { IMG_TOKEN: "secret" },
    );
    expect(res.status).toBe(401);
  });

  // Content-Length が上限を超えていれば formData() を読む前に 413 で落とす。
  // 実際に 20MB のボディを送ると遅いので、ヘッダだけ偽って検証する。
  it("Content-Length が上限を超える POST は 413", async () => {
    const res = await app.request(
      "/api/images",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Length": "30000000",
        },
        body: new FormData(),
      },
      { IMG_TOKEN: "secret" },
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "too_large" });
  });

  // API を Vike の前に置いているので、ここに無いパスは Vike に渡る。
  // この app 単体では 404 になるのが正しい。
  it("知らないパスは 404", async () => {
    expect((await app.request("/nope/nope")).status).toBe(404);
  });
});
