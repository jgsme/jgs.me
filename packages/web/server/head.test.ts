import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { headAsGet } from "./head";

// vike のハンドラは universal-middleware のルーターに method: "GET" だけで
// 登録されており、そのルーターは Hono の Context ではなく c.req.raw の method を
// 見る。Hono は HEAD を GET として dispatch するのでハンドラまでは届くが、
// raw が HEAD のままなのでルーターが外し、Hono の notFound に落ちていた。
// このミドルウェアは raw を GET に差し替えて、下流にそう見せる。
function appWith(onRequest: (raw: Request) => void) {
  const app = new Hono();
  app.use("*", headAsGet);
  app.get("/pages/*", (c) => {
    onRequest(c.req.raw);
    return c.text("本体", 200);
  });
  return app;
}

describe("headAsGet", () => {
  it("HEAD のとき下流から見える raw の method を GET にする", async () => {
    let seen = "";
    const app = appWith((raw) => {
      seen = raw.method;
    });

    await app.request("https://w.jgs.me/pages/x", { method: "HEAD" });

    expect(seen).toBe("GET");
  });

  it("GET の raw はそのまま", async () => {
    let seen = "";
    const app = appWith((raw) => {
      seen = raw.method;
    });

    await app.request("https://w.jgs.me/pages/x");

    expect(seen).toBe("GET");
  });

  it("差し替えても URL とヘッダは保つ", async () => {
    let seen: Request | undefined;
    const app = appWith((raw) => {
      seen = raw;
    });

    await app.request("https://w.jgs.me/pages/x?q=1", {
      method: "HEAD",
      headers: { "user-agent": "probe" },
    });

    expect(seen?.url).toBe("https://w.jgs.me/pages/x?q=1");
    expect(seen?.headers.get("user-agent")).toBe("probe");
  });

  it("POST は触らない", async () => {
    let seen = "";
    const app = new Hono();
    app.use("*", headAsGet);
    app.post("/pages/*", (c) => {
      seen = c.req.raw.method;
      return c.text("ok", 200);
    });

    await app.request("https://w.jgs.me/pages/x", { method: "POST" });

    expect(seen).toBe("POST");
  });
});
