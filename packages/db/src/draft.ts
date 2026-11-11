// 下書きの閲覧鍵。URL (/drafts/<鍵>) を知っている人だけが読めるようにするので、
// 推測できないよう 256 bit の乱数にする。
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newDraftKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isDraftKey(s: string): boolean {
  return KEY_PATTERN.test(s);
}

export function draftPath(key: string): string {
  return `/drafts/${key}`;
}

// 末尾の "/" 有無や前方一致の取り違え (/draftsx) を避けるため、完全一致か
// "/drafts/" 始まりだけを下書きの path とみなす。
export function isDraftPath(pathname: string): boolean {
  return pathname === "/drafts" || pathname.startsWith("/drafts/");
}
