import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../db";
import { TOKEN_KEY, getToken, refreshToken, withToken } from "./token";

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
    vi.stubGlobal("fetch", async () =>
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
});

describe("withToken", () => {
  it("200 ならそのまま返す", async () => {
    const env = makeEnv({});
    const res = await withToken(env, async () => new Response("ok", { status: 200 }));
    expect(res.status).toBe(200);
  });

  it("401 なら KV を消して seed で1度だけやり直す", async () => {
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
  });

  it("seed でも 401 なら通知する", async () => {
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
  });
});
