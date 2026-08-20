// Fediverse の事実上の標準。spec §4.2 で実在の Mastodon 公開鍵が
// この組み合わせで import できることを確認済み。
export const RSA_PARAMS = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

const IMPORT_PARAMS = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// 相手が返す PEM は改行コードも余白もまちまちなので、
// ヘッダ行と空白を全部落としてから base64 として読む。
function pemBody(pem: string) {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  if (body.length === 0) throw new Error("empty PEM body");
  return b64ToBytes(body);
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(RSA_PARAMS, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", pemBody(pem), IMPORT_PARAMS, false, [
    "sign",
  ]);
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", pemBody(pem), IMPORT_PARAMS, true, [
    "verify",
  ]);
}

export async function exportPublicPem(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", key);
  const lines = bytesToB64(spki).match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

// Secrets に PEM を貼るとき改行がスペースに潰れることが実際にあった。
// actor の publicKeyPem は生のまま相手に渡り、ヘッダ行と改行が
// 欠けていると Mastodon が鍵を読めない。入力がどう壊れていても
// base64 本文だけ取り出して組み直す。
export function normalizePublicPem(raw: string): string {
  const body = raw
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  if (body.length === 0) throw new Error("empty PEM body");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}
