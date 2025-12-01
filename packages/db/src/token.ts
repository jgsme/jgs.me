const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function generateToken(
  pageId: number,
  secret: string
): Promise<string> {
  const key = await getKey(secret);
  const data = encoder.encode(String(pageId));
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return `${pageId}.${toHex(signature).slice(0, 16)}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<number | null> {
  const [pageIdStr, sig] = token.split(".");
  if (!pageIdStr || !sig) return null;

  const pageId = parseInt(pageIdStr, 10);
  if (isNaN(pageId)) return null;

  const key = await getKey(secret);
  const data = encoder.encode(String(pageId));
  const expectedSig = await crypto.subtle.sign("HMAC", key, data);
  const expectedHex = toHex(expectedSig).slice(0, 16);

  if (sig !== expectedHex) return null;

  return pageId;
}
