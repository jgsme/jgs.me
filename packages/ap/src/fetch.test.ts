import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_AGENT } from "./config";
import { fetchRemoteActor } from "./remote";
import { deliver } from "./deliver";
import { generateKeyPair } from "./sig/keys";

// Cloudflare Workers の fetch は User-Agent を送らない。mstdn.jp は
// Cloudflare の背後で UA なしのリクエストを別ホストへ 301 する設定に
// なっており、そのせいで相手の公開鍵を取得できず Follow を弾いていた。
// 外向きのリクエストには必ず UA を付ける。

const kv = {
  get: async () => null,
  put: async () => {},
} as unknown as KVNamespace;

const ACTOR = {
  id: "https://mstdn.jp/users/jgs",
  inbox: "https://mstdn.jp/users/jgs/inbox",
  publicKey: { publicKeyPem: "PEM" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("USER_AGENT", () => {
  it("ソフト名と連絡先 URL を含む", () => {
    expect(USER_AGENT).toContain("jgs-me/");
    expect(USER_AGENT).toContain("+https://w.jgs.me/");
  });
});

describe("fetchRemoteActor", () => {
  it("User-Agent を付けて取りに行く", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify(ACTOR), { status: 200 });
    });

    await fetchRemoteActor("https://mstdn.jp/users/jgs", kv);
    const headers = calls[0]!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(USER_AGENT);
  });

  it("UA が undefined のまま送られていないこと", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify(ACTOR), { status: 200 });
    });

    await fetchRemoteActor("https://mstdn.jp/users/jgs", kv);
    const ua = (calls[0]!.headers as Record<string, string>)["User-Agent"];
    expect(typeof ua).toBe("string");
    expect(ua.length).toBeGreaterThan(0);
  });

  it("応答が ok でなければ null", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    expect(await fetchRemoteActor("https://mstdn.jp/users/jgs", kv)).toBeNull();
  });
});

describe("deliver", () => {
  it("User-Agent を付けて配送する", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      calls.push(init);
      return new Response("", { status: 202 });
    });

    const { privateKey } = await generateKeyPair();
    await deliver(
      "https://mstdn.jp/users/jgs/inbox",
      { type: "Accept" },
      privateKey,
    );
    const headers = calls[0]!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(USER_AGENT);
  });

  it("cavage が 401 なら RFC 9421 で再送し、そちらにも UA を付ける", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      calls.push(init);
      return new Response("", { status: calls.length === 1 ? 401 : 202 });
    });

    const { privateKey } = await generateKeyPair();
    const r = await deliver(
      "https://mstdn.jp/users/jgs/inbox",
      { type: "Accept" },
      privateKey,
    );
    expect(r.variant).toBe("rfc9421");
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect((c.headers as Record<string, string>)["User-Agent"]).toBe(
        USER_AGENT,
      );
    }
  });
});
