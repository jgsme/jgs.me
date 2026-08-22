import { describe, expect, it } from "vitest";
import { toArticle } from "./as2";
import {
  wrapActorUpdate,
  wrapCreate,
  wrapDelete,
  wrapUpdate,
} from "./activities";
import { ACTOR_URI, buildActor } from "./actor";

const ARTICLE = toArticle(
  {
    id: 1234,
    title: "テスト",
    created: "2026-08-01T12:00:00.000Z",
    updated: "2026-08-02T09:30:00.000Z",
  },
  "<p>本文</p>",
);

describe("wrapCreate", () => {
  const a = wrapCreate(ARTICLE);

  it("type は Create", () => {
    expect(a.type).toBe("Create");
  });

  it("actor は自分", () => {
    expect(a.actor).toBe(ACTOR_URI);
  });

  it("object にオブジェクト全体が入る", () => {
    expect(a.object.id).toBe("https://w.jgs.me/o/1234");
    expect(a.object.content).toBe("<p>本文</p>");
  });

  it("activity の id は object の id に接尾辞を付けたもの (重複排除に使われる)", () => {
    expect(a.id).toBe("https://w.jgs.me/o/1234#create");
  });

  it("published が object と揃う", () => {
    expect(a.published).toBe("2026-08-01T12:00:00.000Z");
  });

  it("to は Public", () => {
    expect(a.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
  });
});

describe("wrapUpdate", () => {
  const a = wrapUpdate(ARTICLE);

  it("type は Update", () => {
    expect(a.type).toBe("Update");
  });

  it("S2S の Update は完全置換なのでオブジェクト全体が入る", () => {
    expect(a.object.name).toBe("テスト");
    expect(a.object.content).toBe("<p>本文</p>");
    expect(a.object.url).toBeDefined();
  });

  it("object.updated が入っている (無いと Mastodon が処理しない)", () => {
    expect(a.object.updated).toBe("2026-08-02T09:30:00.000Z");
  });

  it("id は updated の値を含む (編集ごとに別 activity になる)", () => {
    expect(a.id).toBe(
      "https://w.jgs.me/o/1234#update-2026-08-02T09:30:00.000Z",
    );
  });
});

describe("wrapDelete", () => {
  const a = wrapDelete("https://w.jgs.me/o/1234");

  it("type は Delete", () => {
    expect(a.type).toBe("Delete");
  });

  it("object は Tombstone", () => {
    expect(a.object).toEqual({
      id: "https://w.jgs.me/o/1234",
      type: "Tombstone",
    });
  });

  it("id は object の id に接尾辞を付けたもの", () => {
    expect(a.id).toBe("https://w.jgs.me/o/1234#delete");
  });

  it("to は Public", () => {
    expect(a.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
  });
});

describe("wrapActorUpdate", () => {
  const ACTOR = buildActor(
    "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----",
  );
  const a = wrapActorUpdate(ACTOR, "2026-08-21T12:00:00.000Z");

  it("type は Update", () => {
    expect(a.type).toBe("Update");
  });

  it("actor と object.id が同じ (自分自身の更新)", () => {
    expect(a.actor).toBe(ACTOR_URI);
    expect(a.object.id).toBe(ACTOR_URI);
  });

  it("object に actor document 全体が入る (S2S の Update は完全置換)", () => {
    expect(a.object.icon).toBeDefined();
    expect(a.object.image).toBeDefined();
    expect(a.object.publicKey.publicKeyPem).toContain("BEGIN PUBLIC KEY");
  });

  it("id は now を含む (送るたびに別 activity になる)", () => {
    expect(a.id).toBe(
      "https://w.jgs.me/ap/actor#update-2026-08-21T12:00:00.000Z",
    );
  });

  it("同じ now なら同じ id (決定的)", () => {
    expect(wrapActorUpdate(ACTOR, "2026-08-21T12:00:00.000Z").id).toBe(a.id);
  });

  it("違う now なら違う id", () => {
    expect(wrapActorUpdate(ACTOR, "2026-08-21T13:00:00.000Z").id).not.toBe(
      a.id,
    );
  });

  it("to は Public", () => {
    expect(a.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
  });

  // object に publicKey が入るため、top-level の @context だけを見る
  // 実装でも鍵の語彙が引けるようにする。
  it("@context に security/v1 が入る", () => {
    expect(a["@context"]).toContain("https://w3id.org/security/v1");
  });
});
