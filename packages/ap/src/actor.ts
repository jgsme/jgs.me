import { SITE_URL } from "./config";

export const USERNAME = "jigsaw";
export const DOMAIN = new URL(SITE_URL).host;

export const ACTOR_URI = `${SITE_URL}/ap/actor`;
export const KEY_ID = `${ACTOR_URI}#main-key`;
export const INBOX_URI = `${SITE_URL}/ap/inbox`;
export const OUTBOX_URI = `${SITE_URL}/ap/outbox`;
export const FOLLOWERS_URI = `${SITE_URL}/ap/followers`;

export type ActorDocument = {
  "@context": string[];
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
