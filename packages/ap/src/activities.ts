import { PUBLIC, type AS2Article } from "./as2";
import { ACTOR_CONTEXT, ACTOR_URI, type ActorDocument } from "./actor";

const CONTEXT = "https://www.w3.org/ns/activitystreams";

export type CreateActivity = {
  "@context": string;
  id: string;
  type: "Create";
  actor: string;
  published: string;
  to: string[];
  object: AS2Article;
};

export type UpdateActivity = {
  "@context": string;
  id: string;
  type: "Update";
  actor: string;
  to: string[];
  object: AS2Article;
};

export type DeleteActivity = {
  "@context": string;
  id: string;
  type: "Delete";
  actor: string;
  to: string[];
  object: { id: string; type: "Tombstone" };
};

export function wrapCreate(article: AS2Article): CreateActivity {
  return {
    "@context": CONTEXT,
    // 受信側は activity id で重複排除する。object id から決定的に導く。
    id: `${article.id}#create`,
    type: "Create",
    actor: ACTOR_URI,
    published: article.published,
    to: [PUBLIC],
    object: article,
  };
}

export function wrapUpdate(article: AS2Article): UpdateActivity {
  return {
    "@context": CONTEXT,
    // 編集のたびに別の activity として扱われる必要があるため updated を含める。
    id: `${article.id}#update-${article.updated}`,
    type: "Update",
    actor: ACTOR_URI,
    to: [PUBLIC],
    // S2S の Update は部分更新ではなく完全置換。オブジェクト全体を詰める。
    object: article,
  };
}

export function wrapDelete(objectURI: string): DeleteActivity {
  return {
    "@context": CONTEXT,
    id: `${objectURI}#delete`,
    type: "Delete",
    actor: ACTOR_URI,
    to: [PUBLIC],
    object: { id: objectURI, type: "Tombstone" },
  };
}

export type UpdateActorActivity = {
  "@context": (string | Record<string, string>)[];
  id: string;
  type: "Update";
  actor: string;
  to: string[];
  object: ActorDocument;
};

// プロフィールを変えても、相手は actor をキャッシュしているため
// 再取得するまで反映されない (おおむね1日)。即時反映させるにはこれを配る。
// 受信側は activity id で重複排除するので、送るたびに id が変わる必要がある。
// now を引数で受けるのは、このモジュールを純粋関数のまま保つため。
export function wrapActorUpdate(
  actor: ActorDocument,
  now: string,
): UpdateActorActivity {
  return {
    // object に publicKey が入るため、top-level の @context だけを見る
    // 実装でも鍵の語彙が引けるように actor と同じものを使う。
    "@context": ACTOR_CONTEXT,
    id: `${ACTOR_URI}#update-${now}`,
    type: "Update",
    actor: ACTOR_URI,
    to: [PUBLIC],
    // S2S の Update は完全置換。actor document 全体を詰める。
    object: actor,
  };
}
