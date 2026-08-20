import { importPublicKey } from "./sig/keys";
import { USER_AGENT } from "./config";

export type RemoteActor = {
  id: string;
  inbox: string;
  sharedInbox: string | null;
  publicKeyPem: string;
  name: string | null;
  icon: string | null;
};

const ACTOR_TTL = 60 * 60 * 24; // 24h
const ACCEPT = "application/activity+json, application/ld+json";

function pickIcon(icon: unknown): string | null {
  if (typeof icon === "string") return icon;
  if (icon && typeof icon === "object" && "url" in icon) {
    const u = (icon as { url: unknown }).url;
    if (typeof u === "string") return u;
  }
  return null;
}

export async function fetchRemoteActor(
  uri: string,
  kv: KVNamespace,
): Promise<RemoteActor | null> {
  const cacheKey = `actor:${uri}`;
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached as RemoteActor;

  const res = await fetch(uri, {
    headers: { Accept: ACCEPT, "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    console.log(`[remote] fetch failed uri=${uri} status=${res.status}`);
    return null;
  }

  const doc = (await res.json()) as Record<string, any>;
  const pem = doc?.publicKey?.publicKeyPem;
  const inbox = doc?.inbox;
  if (typeof pem !== "string" || typeof inbox !== "string") {
    console.log(`[remote] actor missing publicKeyPem/inbox uri=${uri}`);
    return null;
  }

  const actor: RemoteActor = {
    id: typeof doc.id === "string" ? doc.id : uri,
    inbox,
    sharedInbox:
      typeof doc?.endpoints?.sharedInbox === "string"
        ? doc.endpoints.sharedInbox
        : null,
    publicKeyPem: pem,
    name: typeof doc.name === "string" ? doc.name : null,
    icon: pickIcon(doc.icon),
  };

  await kv.put(cacheKey, JSON.stringify(actor), { expirationTtl: ACTOR_TTL });
  return actor;
}

// keyId は通常 <actor URI>#main-key。フラグメントを落として actor を引く。
export async function fetchPublicKey(
  keyId: string,
  kv: KVNamespace,
): Promise<CryptoKey | null> {
  const actorURI = keyId.split("#")[0]!;
  const actor = await fetchRemoteActor(actorURI, kv);
  if (!actor) return null;
  try {
    return await importPublicKey(actor.publicKeyPem);
  } catch {
    return null;
  }
}
