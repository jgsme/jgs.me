// mote (短い動画のサービス。ページの URL は https://mote.jgs.me/u/<actor>/<rkey>)
// の URL の規則。web (描画) と ingest (サムネ) が同じ規則を使うのでここに置く。

import { parse, type Node } from "@progfay/scrapbox-parser";

export const MOTE_ORIGIN = "https://mote.jgs.me";

export interface MoteRef {
  readonly actor: string; // decode 済み。handle か DID
  readonly rkey: string;
  readonly url: string; // 正規化した URL。map の key に使う
}

// atproto の TID (13 文字の base32-sortable)。
const RKEY = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

// 展開後の actor に許す文字 (handle と DID)。? # 空白などが残ると url が曖昧になる。
const ACTOR = /^[A-Za-z0-9.:_-]+$/;

/** URL 全体が mote のページの URL なら分解する。違えば null */
export function parseMoteUrl(url: string): MoteRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.host !== "mote.jgs.me") return null;
  if (u.username !== "" || u.password !== "" || u.port !== "") return null;

  // /u/<actor>/<rkey>。末尾の / は 1 つまで許す。
  const m = /^\/u\/([^/]+)\/([^/]+?)\/?$/.exec(u.pathname);
  if (!m) return null;
  const [, rawActor, rkey] = m;
  if (!RKEY.test(rkey)) return null;

  let actor: string;
  try {
    actor = decodeURIComponent(rawActor);
  } catch {
    return null;
  }
  if (!ACTOR.test(actor)) return null;

  return { actor, rkey, url: `${MOTE_ORIGIN}/u/${actor}/${rkey}` };
}

/**
 * mote の JSON から来た URL (video / poster / page) を使ってよいか。
 * origin が mote.jgs.me の https で、userinfo が無いものだけ通す
 * (origin は userinfo を落として比べるので、それだけでは弾けない)。
 */
export function isMoteUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.origin === MOTE_ORIGIN && u.username === "" && u.password === "";
}

/** JSON を引く URL */
export function moteApiUrl(ref: MoteRef): string {
  return `${MOTE_ORIGIN}/v1/videos/${encodeURIComponent(ref.actor)}/${ref.rkey}`;
}

// 読み側 (web の ScrapboxNode / ap の scrapboxToHtml) と同じ scrapbox-parser を
// 通す。コードブロックに貼った URL を拾わないため。
function findInNodes(nodes: readonly Node[]): MoteRef | null {
  for (const node of nodes) {
    if (node.type === "link" && node.pathType !== "relative") {
      const ref = parseMoteUrl(node.href);
      if (ref) return ref;
    }
    // decoration / strong / quote は子ノードを持つ。
    if ("nodes" in node) {
      const found = findInNodes(node.nodes);
      if (found) return found;
    }
  }
  return null;
}

/** Scrapbox 記法の本文から最初の mote の URL を返す。無ければ null */
export function firstMoteUrl(content: string): MoteRef | null {
  if (!content.trim()) return null;

  for (const block of parse(content, { hasTitle: false })) {
    if (block.type === "line") {
      const found = findInNodes(block.nodes);
      if (found) return found;
      continue;
    }
    if (block.type === "table") {
      for (const row of block.cells) {
        for (const cell of row) {
          const found = findInNodes(cell);
          if (found) return found;
        }
      }
    }
    // codeBlock は本文でもリンクにならないので見ない。
  }
  return null;
}
