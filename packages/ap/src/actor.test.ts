import { describe, expect, it } from "vitest";
import {
  ACTOR_URI,
  INBOX_URI,
  KEY_ID,
  buildActor,
  buildWebfinger,
} from "./actor";

const PEM = "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----";

describe("buildActor", () => {
  const a = buildActor(PEM);

  it("id が actor URI", () => {
    expect(a.id).toBe("https://w.jgs.me/ap/actor");
  });

  it("type は Person", () => {
    expect(a.type).toBe("Person");
  });

  it("preferredUsername が WebFinger の acct と一致する", () => {
    expect(a.preferredUsername).toBe("jigsaw");
  });

  it("inbox / outbox / followers を持つ", () => {
    expect(a.inbox).toBe("https://w.jgs.me/ap/inbox");
    expect(a.outbox).toBe("https://w.jgs.me/ap/outbox");
    expect(a.followers).toBe("https://w.jgs.me/ap/followers");
  });

  it("publicKey に id / owner / publicKeyPem が揃う", () => {
    expect(a.publicKey.id).toBe(KEY_ID);
    expect(a.publicKey.owner).toBe(ACTOR_URI);
    expect(a.publicKey.publicKeyPem).toBe(PEM);
  });

  it("鍵 ID は actor URI に #main-key を付けたもの", () => {
    expect(KEY_ID).toBe(`${ACTOR_URI}#main-key`);
  });

  it("@context に security/v1 が入る (publicKey の語彙に必要)", () => {
    expect(a["@context"]).toContain("https://w3id.org/security/v1");
  });

  it("url は人間向けのサイトトップ", () => {
    expect(a.url).toBe("https://w.jgs.me/");
  });

  it("manuallyApprovesFollowers は false (Follow を自動で Accept する)", () => {
    expect(a.manuallyApprovesFollowers).toBe(false);
  });
});

describe("buildWebfinger", () => {
  it("acct:jigsaw@w.jgs.me を解決する", () => {
    const w = buildWebfinger("acct:jigsaw@w.jgs.me");
    expect(w).not.toBeNull();
    expect(w!.subject).toBe("acct:jigsaw@w.jgs.me");
  });

  it("self link が actor を activity+json で指す", () => {
    const w = buildWebfinger("acct:jigsaw@w.jgs.me")!;
    const self = w.links.find((l) => l.rel === "self");
    expect(self).toEqual({
      rel: "self",
      type: "application/activity+json",
      href: ACTOR_URI,
    });
  });

  it("大文字小文字を無視する", () => {
    expect(buildWebfinger("acct:JIGSAW@W.JGS.ME")).not.toBeNull();
  });

  it("別のユーザ名は null", () => {
    expect(buildWebfinger("acct:someone@w.jgs.me")).toBeNull();
  });

  it("別のドメインは null", () => {
    expect(buildWebfinger("acct:jigsaw@example.com")).toBeNull();
  });

  it("acct: 以外のスキームは null", () => {
    expect(buildWebfinger("https://w.jgs.me/ap/actor")).toBeNull();
  });
});

// INBOX_URI は inbox ルートと配送先の両方で使うので export されていること
describe("定数", () => {
  it("INBOX_URI が定義されている", () => {
    expect(INBOX_URI).toBe("https://w.jgs.me/ap/inbox");
  });
});
