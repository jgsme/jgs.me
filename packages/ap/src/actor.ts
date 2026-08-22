import { AVATAR_URL, HEADER_URL, SITE_URL } from "./config";

export const USERNAME = "jigsaw";
export const DOMAIN = new URL(SITE_URL).host;

export const ACTOR_URI = `${SITE_URL}/ap/actor`;
export const KEY_ID = `${ACTOR_URI}#main-key`;
export const INBOX_URI = `${SITE_URL}/ap/inbox`;
export const OUTBOX_URI = `${SITE_URL}/ap/outbox`;
export const FOLLOWERS_URI = `${SITE_URL}/ap/followers`;

export type AS2Image = {
  type: "Image";
  mediaType: string;
  url: string;
};

// Mastodon のプロフィールのメタデータ欄になる。schema.org 由来で
// AS2 の語彙には無いため @context で定義を足している。
export type PropertyValue = {
  type: "PropertyValue";
  name: string;
  value: string;
};

export type ActorDocument = {
  "@context": (string | Record<string, string>)[];
  id: string;
  type: "Person";
  preferredUsername: string;
  name: string;
  summary: string;
  url: string;
  inbox: string;
  outbox: string;
  followers: string;
  manuallyApprovesFollowers: boolean;
  icon: AS2Image;
  image: AS2Image;
  attachment: PropertyValue[];
  publicKey: { id: string; owner: string; publicKeyPem: string };
};

export type WebfingerDocument = {
  subject: string;
  aliases: string[];
  links: { rel: string; type?: string; href: string }[];
};

export function buildActor(publicKeyPem: string): ActorDocument {
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      // publicKey / publicKeyPem の語彙はここで定義される。
      // 欠けていると Mastodon が鍵を読めない。
      "https://w3id.org/security/v1",
      // attachment に入れる PropertyValue の語彙。Mastodon は無くても
      // 読むが、JSON-LD を厳密に処理する実装では定義の無い項目が落ちる。
      {
        schema: "http://schema.org#",
        PropertyValue: "schema:PropertyValue",
        value: "schema:value",
      },
    ],
    id: ACTOR_URI,
    type: "Person",
    preferredUsername: USERNAME,
    name: "jigsaw",
    summary: "",
    url: `${SITE_URL}/`,
    inbox: INBOX_URI,
    outbox: OUTBOX_URI,
    followers: FOLLOWERS_URI,
    // Follow を自動で Accept する。承認制にしない。
    manuallyApprovesFollowers: false,
    // 受信側は URL をフェッチして自前で再ホストする。ここは公開 URL を
    // 出すだけでよい。文字列 URL も仕様上は許されるが、mediaType を
    // 付けられるオブジェクト形式のほうが実装間の相性が良い。
    icon: { type: "Image", mediaType: "image/png", url: AVATAR_URL },
    image: { type: "Image", mediaType: "image/png", url: HEADER_URL },
    attachment: [
      {
        type: "PropertyValue",
        name: "Website",
        value: `<a href="${SITE_URL}/">w.jgs.me</a>`,
      },
    ],
    publicKey: { id: KEY_ID, owner: ACTOR_URI, publicKeyPem },
  };
}

export function buildWebfinger(resource: string): WebfingerDocument | null {
  const want = `acct:${USERNAME}@${DOMAIN}`.toLowerCase();
  if (resource.trim().toLowerCase() !== want) return null;
  return {
    subject: `acct:${USERNAME}@${DOMAIN}`,
    aliases: [ACTOR_URI, `${SITE_URL}/`],
    links: [
      { rel: "self", type: "application/activity+json", href: ACTOR_URI },
      {
        rel: "http://webfinger.net/rel/profile-page",
        type: "text/html",
        href: `${SITE_URL}/`,
      },
    ],
  };
}
