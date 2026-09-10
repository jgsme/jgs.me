import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../db";
import {
  NOTIFY_KEY_PREFIX,
  TOKEN_KEY,
  getToken,
  refreshToken,
  withToken,
} from "./token";

type Store = Record<string, string>;

function makeEnv(store: Store, seed = "SEED"): Env {
  const kv = {
    get: async (key: string, type?: string) => {
      const raw = store[key];
      if (raw === undefined) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    },
    put: async (key: string, value: string) => {
      store[key] = value;
    },
    delete: async (key: string) => {
      delete store[key];
    },
  } as unknown as KVNamespace;

  return {
    KV: kv,
    THREADS_SEED_TOKEN: seed,
    DISCORD_REACTION_WEBHOOK: "https://discord.example/webhook",
  } as unknown as Env;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getToken", () => {
  it("KV にあればそれを使う", async () => {
    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "FROM_KV",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    expect(await getToken(makeEnv(store))).toBe("FROM_KV");
  });

  it("KV が空なら seed に落ちる", async () => {
    expect(await getToken(makeEnv({}))).toBe("SEED");
  });
});

describe("refreshToken", () => {
  it("成功したら新しいトークンを KV に書く", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            access_token: "NEW",
            token_type: "bearer",
            expires_in: 5183944,
          }),
          { status: 200 },
        ),
    );

    const store: Store = {};
    const env = makeEnv(store);
    await refreshToken(env);

    const saved = JSON.parse(store[TOKEN_KEY]!);
    expect(saved.accessToken).toBe("NEW");
    expect(saved.expiresAt).toBeGreaterThan(Date.now());
  });

  it("失敗したら Discord に通知して throw する", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      if (url.includes("discord")) {
        posted.push(init.body as string);
        return new Response("", { status: 204 });
      }
      return new Response("nope", { status: 400 });
    });

    await expect(refreshToken(makeEnv({}))).rejects.toThrow();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("Threads");
  });

  it("access_token が欠けたレスポンスは KV に書かず throw する", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ token_type: "bearer", expires_in: 100 }),
          {
            status: 200,
          },
        ),
    );

    const store: Store = {};
    await expect(refreshToken(makeEnv(store))).rejects.toThrow();
    expect(store[TOKEN_KEY]).toBeUndefined();
  });

  it("KV にあるトークンを refresh に渡す (seed ではなく KV のものを使う)", async () => {
    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "STORED",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      requested.push(url);
      return new Response(
        JSON.stringify({
          access_token: "NEW",
          token_type: "bearer",
          expires_in: 5183944,
        }),
        { status: 200 },
      );
    });

    await refreshToken(makeEnv(store, "SEED"));

    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain("access_token=STORED");
    expect(requested[0]).not.toContain("access_token=SEED");
  });
});

describe("withToken", () => {
  it("200 ならそのまま返す", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response("", { status: 204 });
    });

    const env = makeEnv({});
    const res = await withToken(
      env,
      async () => new Response("ok", { status: 200 }),
    );

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("401 で seed が通ったときだけ KV を消す", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response("", { status: 204 });
    });

    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "DEAD",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    const env = makeEnv(store, "SEED");

    const seen: string[] = [];
    const res = await withToken(env, async (token) => {
      seen.push(token);
      return new Response("", { status: token === "SEED" ? 200 : 401 });
    });

    expect(seen).toEqual(["DEAD", "SEED"]);
    expect(res.status).toBe(200);
    expect(store[TOKEN_KEY]).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("seed でも 401 なら通知する。KV は消さない", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      posted.push(init.body as string);
      return new Response("", { status: 204 });
    });

    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "DEAD",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    const env = makeEnv(store, "ALSO_DEAD");

    const res = await withToken(
      env,
      async () => new Response("", { status: 401 }),
    );

    expect(res.status).toBe(401);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("手動 OAuth");
    // seed も死んでいる以上 KV のトークンが死んでいる確証は無い。
    // 一過性の 401 で唯一生きている資格情報を捨てない。
    expect(store[TOKEN_KEY]).toBeDefined();
  });

  it("400 + error.code 190 も失効として扱う", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      posted.push(init.body as string);
      return new Response("", { status: 204 });
    });

    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "DEAD",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    const env = makeEnv(store, "SEED");

    const oauthError = () =>
      new Response(
        JSON.stringify({
          error: { message: "Session has expired", code: 190 },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );

    const seen: string[] = [];
    const res = await withToken(env, async (token) => {
      seen.push(token);
      return token === "SEED"
        ? new Response("ok", { status: 200 })
        : oauthError();
    });

    expect(seen).toEqual(["DEAD", "SEED"]);
    expect(res.status).toBe(200);
    expect(store[TOKEN_KEY]).toBeUndefined();
    expect(posted).toHaveLength(0);
  });

  it("400 + error.code 190 を読んでも本文は呼び出し元に残る", async () => {
    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "DEAD",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    vi.stubGlobal("fetch", async () => new Response("", { status: 204 }));

    const res = await withToken(
      makeEnv(store, "ALSO_DEAD"),
      async () =>
        new Response(JSON.stringify({ error: { code: 190 } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("190");
  });

  it("190 以外の 400 と JSON でない 400 は失効扱いしない", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      posted.push(init.body as string);
      return new Response("", { status: 204 });
    });

    const store: Store = {
      [TOKEN_KEY]: JSON.stringify({
        accessToken: "LIVE",
        expiresAt: 0,
        refreshedAt: 0,
      }),
    };
    const env = makeEnv(store, "SEED");

    const seen: string[] = [];
    const other = await withToken(env, async (token) => {
      seen.push(token);
      return new Response(JSON.stringify({ error: { code: 100 } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    });
    const html = await withToken(env, async (token) => {
      seen.push(token);
      return new Response("<html>gateway</html>", { status: 400 });
    });

    // どちらも seed でのやり直しをしない。
    expect(seen).toEqual(["LIVE", "LIVE"]);
    expect(other.status).toBe(400);
    expect(html.status).toBe(400);
    expect(posted).toHaveLength(0);
    expect(store[TOKEN_KEY]).toBeDefined();
  });

  it("同じ理由の通知は 24 時間に1度に抑える", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      posted.push(init.body as string);
      return new Response("", { status: 204 });
    });

    const store: Store = {};
    const env = makeEnv(store, "SEED");
    const call = () =>
      withToken(env, async () => new Response("", { status: 401 }));

    await call();
    await call();
    await call();

    expect(posted).toHaveLength(1);
    expect(store[`${NOTIFY_KEY_PREFIX}no-seed`]).toBeDefined();
  });

  it("KV が空で seed が 401 ならやり直さずに通知する", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      posted.push(init.body as string);
      return new Response("", { status: 204 });
    });

    const env = makeEnv({}, "SEED");
    const seen: string[] = [];
    await withToken(env, async (token) => {
      seen.push(token);
      return new Response("", { status: 401 });
    });

    // 同じ seed で2度叩いても無駄なので1回で諦める。
    expect(seen).toEqual(["SEED"]);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("手動 OAuth");
  });
});
