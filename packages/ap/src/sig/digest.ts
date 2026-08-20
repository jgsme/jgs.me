const enc = new TextEncoder();

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function sha256Digest(body: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(body));
  return `SHA-256=${bytesToB64(h)}`;
}

// Digest は body の改竄検知。署名は Digest ヘッダを covered header に含めるため、
// この2つが揃って初めて body の完全性が保証される。
export async function verifyDigest(
  body: string,
  header: string | null,
): Promise<boolean> {
  if (!header) return false;
  if (!header.startsWith("SHA-256=")) return false;
  return header === (await sha256Digest(body));
}
