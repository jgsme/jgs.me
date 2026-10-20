import {
  reportLines,
  writesFor,
  type ClipNoteItem,
  type Write,
} from "./clipMarginWrites.ts";

const DEFAULT_PDS_URL = "https://ds.jgs.me";
// Margin で作った「clips」コレクション。サイトに出す clip はこの中身。
const DEFAULT_COLLECTION =
  "at://did:web:ds.jgs.me/at.margin.collection/3mybpszk6ns2v";
// 1 回で 50 clip = 100 write。dirig の applyWrites の上限は 200。
const PAGE_SIZE = 50;
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const ARGV_OFFSET = 2;

type Envelope = {
  readonly processed: number;
  readonly nextCursor: number | null;
  readonly items: readonly ClipNoteItem[];
};

type Session = { readonly did: string; readonly accessJwt: string };

function usage(): never {
  console.error(
    [
      "usage: pnpm clip-margin [--dry-run]",
      "",
      "  clip を Margin の at.margin.note として PDS (ds.jgs.me) に書き、",
      "  clips コレクションに入れる (at.margin.collectionItem)。",
      "",
      "  rkey は clip から決まるので、何度流しても同じ record を上書きするだけ。",
      "  出典 URL を拾えなかった clip は書かずに skip として標準出力に出す。",
      "",
      "  --dry-run  PDS に書かず、変換結果の集計と skip / warn だけ出す",
      "",
      "  環境変数: INGEST_URL / SIMILARITY_TOKEN",
      "            PDS_IDENTIFIER / PDS_PASSWORD (--dry-run では不要)",
      `            PDS_URL (既定 ${DEFAULT_PDS_URL})`,
      "            MARGIN_COLLECTION (既定 clips コレクションの at-uri)",
    ].join("\n"),
  );
  process.exit(1);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`環境変数 ${name} が要る`);
    process.exit(1);
  }
  return v;
}

async function fetchNotes(cursor: number): Promise<Envelope> {
  const res = await fetch(`${env("INGEST_URL")}/internal/clip-notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SIMILARITY_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor, limit: PAGE_SIZE }),
  });
  if (!res.ok) throw new Error(`clip-notes ${res.status}: ${await res.text()}`);
  return (await res.json()) as Envelope;
}

function pdsUrl(): string {
  const url = process.env.PDS_URL ?? DEFAULT_PDS_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function createSession(): Promise<Session> {
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

/** 書いた後の session を返す。期限切れなら張り直して 1 回だけ再試行する */
async function applyWrites(
  s: Session,
  writes: readonly Write[],
): Promise<Session> {
  if (writes.length === 0) return s;
  const first = await postWrites(s, writes);
  const expired = await isExpired(first);
  const session = expired ? await createSession() : s;
  const res = expired ? await postWrites(session, writes) : first;
  if (!res.ok)
    throw new Error(`applyWrites ${res.status}: ${await res.text()}`);
  return session;
}

type Totals = {
  readonly seen: number;
  readonly written: number;
  readonly lines: readonly string[];
};

async function run(
  dryRun: boolean,
  cursor: number,
  session: Session | null,
  totals: Totals,
): Promise<Totals> {
  const r = await fetchNotes(cursor);
  const collection = process.env.MARGIN_COLLECTION ?? DEFAULT_COLLECTION;
  const writable = r.items.filter((i) => i.note !== undefined);
  const next =
    session === null
      ? null
      : await applyWrites(
          session,
          writable.flatMap((i) => writesFor(i, session.did, collection)),
        );

  const seen = totals.seen + r.processed;
  console.error(`clip-margin: ${seen} clips${dryRun ? " (dry-run)" : ""}`);
  const after: Totals = {
    seen,
    written: totals.written + writable.length,
    lines: [...totals.lines, ...reportLines(r.items)],
  };
  return r.nextCursor === null ? after : run(dryRun, r.nextCursor, next, after);
}

async function main(): Promise<void> {
  const args = process.argv.slice(ARGV_OFFSET);
  const dryRun = args.includes("--dry-run");
  if (args.some((a) => a !== "--dry-run")) usage();

  const session = dryRun ? null : await createSession();
  const totals = await run(dryRun, 0, session, {
    seen: 0,
    written: 0,
    lines: [],
  });

  const verb = dryRun ? "would write" : "wrote";
  const skipped = totals.lines.filter((l) => l.startsWith("skip")).length;
  console.log(
    `${totals.seen} clips, ${verb} ${totals.written}, skipped ${skipped}`,
  );
  totals.lines.forEach((l) => console.log(l));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
