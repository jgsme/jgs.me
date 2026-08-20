const enc = new TextEncoder();
const ALG = "RSASSA-PKCS1-v1_5";

export const DEFAULT_HEADERS = [
  "(request-target)",
  "host",
  "date",
  "digest",
] as const;

export type SignTarget = {
  method: string;
  url: string;
  headers: Record<string, string>;
};

function bytesToB64(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function cavageSigningString(
  t: SignTarget,
  headerNames: readonly string[],
): string {
  const u = new URL(t.url);
  return headerNames
    .map((name) =>
      name === "(request-target)"
        ? `(request-target): ${t.method.toLowerCase()} ${u.pathname}${u.search}`
        : `${name}: ${t.headers[name] ?? ""}`,
    )
    .join("\n");
}

export async function cavageSign(
  t: SignTarget,
  key: CryptoKey,
  keyId: string,
  headerNames: readonly string[] = DEFAULT_HEADERS,
): Promise<string> {
  const base = cavageSigningString(t, headerNames);
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(base));
  return (
    `keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="${headerNames.join(" ")}",signature="${bytesToB64(sig)}"`
  );
}

export function parseCavageHeader(header: string): {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
} | null {
  const kv: Record<string, string> = {};
  for (const m of header.matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
    kv[m[1]!] = m[2]!;
  }
  if (!kv.keyId || !kv.signature || !kv.headers) return null;
  return {
    keyId: kv.keyId,
    algorithm: kv.algorithm ?? "rsa-sha256",
    headers: kv.headers.split(" ").filter(Boolean),
    signature: kv.signature,
  };
}

export async function cavageVerify(
  t: SignTarget,
  key: CryptoKey,
  header: string,
): Promise<boolean> {
  const parsed = parseCavageHeader(header);
  if (!parsed) return false;
  try {
    const base = cavageSigningString(t, parsed.headers);
    return await crypto.subtle.verify(
      ALG,
      key,
      b64ToBytes(parsed.signature),
      enc.encode(base),
    );
  } catch {
    // base64 が壊れている等。検証失敗として扱い、例外を外に出さない。
    return false;
  }
}
