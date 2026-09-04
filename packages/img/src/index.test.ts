import { describe, expect, it } from "vitest";
import app from "./index";

describe("routing", () => {
  it("/health は ok を返す", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("知らないパスは 404", async () => {
    expect((await app.request("/nope/nope")).status).toBe(404);
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

  // sha256 の形でないパスは D1 を引く前に落とす。
  it("64 桁 hex でないパスは 404", async () => {
    expect((await app.request("/notahash")).status).toBe(404);
    expect((await app.request(`/${"z".repeat(64)}`)).status).toBe(404);
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
});
