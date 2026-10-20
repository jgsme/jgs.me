// clip を PDS に書く CLI (clip-margin / clip-semble) で共有する HTTP の部分。
import type { ClipNoteItem, Write } from "./clipMarginWrites.ts";

const DEFAULT_PDS_URL = "https://ds.jgs.me";
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;

export type Envelope = {
  readonly processed: number;
  readonly nextCursor: number | null;
  readonly items: readonly ClipNoteItem[];
};

export type Session = { readonly did: string; readonly accessJwt: string };

export type WriteResult = { readonly uri?: string; readonly cid?: string };

export function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`環境変数 ${name} が要る`);
    process.exit(1);
  }
  return v;
}

export function pdsUrl(): string {
  const url = process.env.PDS_URL ?? DEFAULT_PDS_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export async function fetchNotes(
  cursor: number,
  limit: number,
): Promise<Envelope> {
  const res = await fetch(`${env("INGEST_URL")}/internal/clip-notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SIMILARITY_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor, limit }),
  });
  if (!res.ok) throw new Error(`clip-notes ${res.status}: ${await res.text()}`);
  return (await res.json()) as Envelope;
}

export async function createSession(): Promise<Session> {
  const res = await fetch(`${pdsUrl()}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: env("PDS_IDENTIFIER"),
      password: env("PDS_PASSWORD"),
    }),
  });
  if (!res.ok) {
    throw new Error(`createSession ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as Session;
}

// 期限切れは 401 だけでなく 400 {"error":"ExpiredToken"} でも来る。
async function isExpired(res: Response): Promise<boolean> {
  if (res.status === UNAUTHORIZED) return true;
  if (res.status !== BAD_REQUEST) return false;
  const b = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  return b?.error === "ExpiredToken" || b?.error === "InvalidToken";
}

function postWrites(s: Session, writes: readonly Write[]): Promise<Response> {
  return fetch(`${pdsUrl()}/xrpc/com.atproto.repo.applyWrites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repo: s.did, writes }),
  });
}

/**
 * 書いた後の session と、writes と同じ並びの結果 (uri / cid) を返す。
 * 期限切れなら張り直して 1 回だけ再試行する
 */
export async function applyWrites(
  s: Session,
  writes: readonly Write[],
): Promise<{
  readonly session: Session;
  readonly results: readonly WriteResult[];
}> {
  if (writes.length === 0) return { session: s, results: [] };
  const first = await postWrites(s, writes);
  const expired = await isExpired(first);
  const session = expired ? await createSession() : s;
  const res = expired ? await postWrites(session, writes) : first;
  if (!res.ok)
    throw new Error(`applyWrites ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { results?: readonly WriteResult[] };
  return { session, results: body.results ?? [] };
}
