import type { SignTarget } from "./cavage";

const enc = new TextEncoder();
const ALG = "RSASSA-PKCS1-v1_5";

export const DEFAULT_COMPONENTS = [
  "@method",
  "@target-uri",
  "host",
  "date",
  "digest",
] as const;

export type Rfc9421Params = {
  created: number;
  keyid: string;
  alg: string;
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

// @ で始まるものは派生コンポーネント。それ以外はヘッダ名。
function componentValue(t: SignTarget, c: string): string {
  const u = new URL(t.url);
  switch (c) {
    case "@method":
      return t.method;
    case "@target-uri":
      return t.url;
    case "@authority":
      return u.host;
    case "@path":
      return u.pathname;
    default:
      return t.headers[c] ?? "";
  }
}

export function rfc9421Base(
  t: SignTarget,
  components: readonly string[],
  params: Rfc9421Params,
): { base: string; inner: string } {
  const inner =
    `(${components.map((c) => `"${c}"`).join(" ")})` +
    `;created=${params.created};keyid="${params.keyid}";alg="${params.alg}"`;
  const lines = components.map((c) => `"${c}": ${componentValue(t, c)}`);
  lines.push(`"@signature-params": ${inner}`);
  return { base: lines.join("\n"), inner };
}

export async function rfc9421Sign(
  t: SignTarget,
  key: CryptoKey,
  params: Rfc9421Params,
  components: readonly string[] = DEFAULT_COMPONENTS,
): Promise<{ "Signature-Input": string; Signature: string }> {
  const { base, inner } = rfc9421Base(t, components, params);
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(base));
  return {
    "Signature-Input": `sig1=${inner}`,
    Signature: `sig1=:${bytesToB64(sig)}:`,
  };
}

export async function rfc9421Verify(
  t: SignTarget,
  key: CryptoKey,
  headers: { "Signature-Input": string; Signature: string },
): Promise<boolean> {
  try {
    const inner = headers["Signature-Input"].replace(/^sig1=/, "");
    const close = inner.indexOf(")");
    if (!inner.startsWith("(") || close < 0) return false;

    const components = inner
      .slice(1, close)
      .split(" ")
      .map((s) => s.replace(/"/g, ""))
      .filter(Boolean);

    const read = (k: string) =>
      inner.match(new RegExp(`${k}="?([^";]+)"?`))?.[1] ?? "";

    const { base } = rfc9421Base(t, components, {
      created: Number(read("created")),
      keyid: read("keyid"),
      alg: read("alg"),
    });

    const raw = headers.Signature.replace(/^sig1=:/, "").replace(/:$/, "");
    return await crypto.subtle.verify(
      ALG,
      key,
      b64ToBytes(raw),
      enc.encode(base),
    );
  } catch {
    return false;
  }
}
