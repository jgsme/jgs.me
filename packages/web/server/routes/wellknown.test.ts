import { describe, expect, it } from "vitest";
import { wellknown } from "./wellknown";

describe("GET /.well-known/site.standard.publication", () => {
  it("publication の at-uri を text/plain で返す", async () => {
    const res = await wellknown.request(
      "/.well-known/site.standard.publication",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toBe(
      "at://did:web:ds.jgs.me/site.standard.publication/w.jgs.me",
    );
  });
});
