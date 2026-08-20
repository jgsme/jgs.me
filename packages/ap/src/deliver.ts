import { sha256Digest } from "./sig/digest";
import { cavageSign, type SignTarget } from "./sig/cavage";
import { rfc9421Sign } from "./sig/rfc9421";
import { KEY_ID } from "./actor";

const AS2 = "application/activity+json";

export type DeliverResult = {
  ok: boolean;
  status: number;
  variant: "cavage" | "rfc9421";
};

function buildTarget(inbox: string, digest: string, date: string): SignTarget {
  return {
    method: "POST",
    url: inbox,
    headers: {
      host: new URL(inbox).host,
      date,
      digest,
      "content-type": AS2,
    },
  };
}

// Fediverse は draft-cavage と RFC 9421 が混在している。
// どちらが通るかは相手実装ごとに違うため、片方で 401/403 が返ったら
// もう片方で再送する (double-knocking)。
// Mastodon が長く cavage を使ってきた経緯から cavage を先に試す。
export async function deliver(
  inbox: string,
  activity: unknown,
  privateKey: CryptoKey,
): Promise<DeliverResult> {
  const body = JSON.stringify(activity);
  const digest = await sha256Digest(body);
  const date = new Date().toUTCString();
  const target = buildTarget(inbox, digest, date);

  const cavage = await cavageSign(target, privateKey, KEY_ID);
  let res = await fetch(inbox, {
    method: "POST",
    headers: {
      Host: target.headers.host!,
      Date: date,
      Digest: digest,
      "Content-Type": AS2,
      Signature: cavage,
    },
    body,
  });

  if (res.status !== 401 && res.status !== 403) {
    return { ok: res.ok, status: res.status, variant: "cavage" };
  }

  const rfc = await rfc9421Sign(target, privateKey, {
    created: Math.floor(Date.now() / 1000),
    keyid: KEY_ID,
    alg: "rsa-v1_5-sha256",
  });
  res = await fetch(inbox, {
    method: "POST",
    headers: {
      Host: target.headers.host!,
      Date: date,
      Digest: digest,
      "Content-Type": AS2,
      "Signature-Input": rfc["Signature-Input"],
      Signature: rfc.Signature,
    },
    body,
  });

  return { ok: res.ok, status: res.status, variant: "rfc9421" };
}
