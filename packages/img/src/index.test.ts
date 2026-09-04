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
});
