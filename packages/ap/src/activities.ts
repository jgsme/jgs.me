import { PUBLIC, type AS2Article } from "./as2";
import { ACTOR_URI } from "./actor";

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
