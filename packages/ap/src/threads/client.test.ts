import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestContainer,
  requestPermalink,
  requestPublish,
  requestRefresh,
} from "./client";

type Call = { url: string; init: RequestInit };

function captureFetch(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200 });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestContainer", () => {
  it("media_type=TEXT と本文と link_attachment を form で送る", async () => {
    const calls = captureFetch();
    await requestContainer("TOKEN", "123", {
      text: "あいう",
      linkAttachment: "https://w.jgs.me/p/9",
    });

    expect(calls[0]!.url).toBe("https://graph.threads.net/v1.0/123/threads");
    expect(calls[0]!.init.method).toBe("POST");

    const body = new URLSearchParams(calls[0]!.init.body as string);
    expect(body.get("media_type")).toBe("TEXT");
    expect(body.get("text")).toBe("あいう");
    expect(body.get("link_attachment")).toBe("https://w.jgs.me/p/9");
    expect(body.get("access_token")).toBe("TOKEN");
  });

  it("User-Agent を付ける", async () => {
    const calls = captureFetch();
    await requestContainer("TOKEN", "123", { text: "あ", linkAttachment: "u" });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("jgs-me/");
  });
});

describe("requestPublish", () => {
  it("creation_id を threads_publish に送る", async () => {
    const calls = captureFetch();
    await requestPublish("TOKEN", "123", "CREATION");

    expect(calls[0]!.url).toBe(
      "https://graph.threads.net/v1.0/123/threads_publish",
    );
    const body = new URLSearchParams(calls[0]!.init.body as string);
    expect(body.get("creation_id")).toBe("CREATION");
    expect(body.get("access_token")).toBe("TOKEN");

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("jgs-me/");
  });
});

describe("requestPermalink", () => {
  it("fields=permalink を付けて media を GET する", async () => {
    const calls = captureFetch();
    await requestPermalink("TOKEN", "MEDIA");

    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe(
      "https://graph.threads.net/v1.0/MEDIA",
    );
    expect(url.searchParams.get("fields")).toBe("permalink");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("jgs-me/");
  });
});

describe("requestRefresh", () => {
  it("バージョンを含まないホスト直下を叩く", async () => {
    const calls = captureFetch();
    await requestRefresh("TOKEN");

    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe(
      "https://graph.threads.net/refresh_access_token",
    );
    expect(url.pathname).not.toContain("v1.0");
    expect(url.searchParams.get("grant_type")).toBe("th_refresh_token");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("jgs-me/");
  });
});
