import { reportLines } from "./clipMarginWrites.ts";
import {
  collectionWrite,
  deleteWrites,
  followUpWrites,
  toSembleClip,
  urlCardWrite,
  type SembleClip,
  type StrongRef,
} from "./clipSembleRecords.ts";
import {
  applyWrites,
  createSession,
  fetchNotes,
  type Session,
  type WriteResult,
} from "./pdsClient.ts";

// 1 回で 50 clip。delete は 1 clip 最大 3 write で 150、dirig の applyWrites の上限 200 に収まる。
const PAGE_SIZE = 50;
const ARGV_OFFSET = 2;
const SETTLE_MS = 60_000;
const MS_PER_SECOND = 1000;

type Mode = "write" | "dry-run" | "delete";

function usage(): never {
  console.error(
    [
      "usage: pnpm clip-semble [--dry-run | --delete]",
      "",
      "  clip を Semble の network.cosmik.card として PDS (ds.jgs.me) に書き、",
      "  clips コレクションに入れる (network.cosmik.collectionLink)。",
      "  出典 URL が URL カード、引用・本文・タグがそれにぶら下がる NOTE カードになる。",
      "",
      "  rkey は clip から決まるので、何度流しても同じ record を上書きするだけ。",
      "  ただし中身が同じ上書きは Jetstream に流れないので、Semble に届け直すときは",
      "  --delete を流してから、付けずにもう一度流す。",
      "",
      "  --dry-run  PDS に書かず、変換結果の集計と skip / warn だけ出す",
      "  --delete   書いた card と collectionLink を消す",
      "",
      "  環境変数: INGEST_URL / SIMILARITY_TOKEN",
      "            PDS_IDENTIFIER / PDS_PASSWORD (--dry-run では不要)",
      "            PDS_URL (既定 https://ds.jgs.me)",
    ].join("\n"),
  );
  process.exit(1);
}

function strongRef(r: WriteResult | undefined): StrongRef {
  if (!r?.uri || !r.cid)
    throw new Error("applyWrites の結果に uri / cid が無い");
  return { uri: r.uri, cid: r.cid };
}

type Pending = { readonly clip: SembleClip; readonly card: StrongRef };

/** URL カードだけ書いて、後で NOTE と link を積むための strongRef を返す */
async function writeCards(
  session: Session,
  clips: readonly SembleClip[],
): Promise<{
  readonly session: Session;
  readonly pending: readonly Pending[];
}> {
  const r = await applyWrites(session, clips.map(urlCardWrite));
  return {
    session: r.session,
    pending: clips.map((clip, i) => ({ clip, card: strongRef(r.results[i]) })),
  };
}

async function deletePage(
  session: Session,
  clips: readonly SembleClip[],
): Promise<Session> {
  return (await applyWrites(session, clips.flatMap(deleteWrites))).session;
}

function truncatedLines(clips: readonly SembleClip[]): readonly string[] {
  return clips
    .filter((c) => c.truncated)
    .map((c) => `warn\tc/${c.clipId}\tNOTE カードの本文を切り詰めた`);
}

type Totals = {
  readonly seen: number;
  readonly written: number;
  readonly lines: readonly string[];
  readonly pending: readonly Pending[];
};

async function step(
  mode: Mode,
  session: Session | null,
  clips: readonly SembleClip[],
): Promise<{
  readonly session: Session | null;
  readonly pending: readonly Pending[];
}> {
  if (session === null) return { session, pending: [] };
  if (mode === "delete")
    return { session: await deletePage(session, clips), pending: [] };
  return writeCards(session, clips);
}

async function run(
  mode: Mode,
  cursor: number,
  session: Session | null,
  totals: Totals,
): Promise<{ readonly session: Session | null; readonly totals: Totals }> {
  const r = await fetchNotes(cursor, PAGE_SIZE);
  const clips = r.items
    .map(toSembleClip)
    .filter((c): c is SembleClip => c !== null);

  const next = await step(mode, session, clips);

  const seen = totals.seen + r.processed;
  console.error(`clip-semble: ${seen} clips (${mode})`);
  const after: Totals = {
    seen,
    written: totals.written + clips.length,
    lines: [...totals.lines, ...reportLines(r.items), ...truncatedLines(clips)],
    pending: [...totals.pending, ...next.pending],
  };
  return r.nextCursor === null
    ? { session: next.session, totals: after }
    : run(mode, r.nextCursor, next.session, after);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * NOTE カードと collectionLink を書く。Semble は Jetstream の event を並行に処理するので、
 * 親の URL カードが取り込まれる前に NOTE が来ると捨てられる。URL カードを全部書いて
 * 少し待ってから流す
 */
async function writeFollowUps(
  session: Session,
  pending: readonly Pending[],
  collection: StrongRef,
): Promise<Session> {
  if (pending.length === 0) return session;
  const page = pending.slice(0, PAGE_SIZE);
  const writes = page.flatMap((p) =>
    followUpWrites(p.clip, p.card, collection, session.did),
  );
  const next = (await applyWrites(session, writes)).session;
  return writeFollowUps(next, pending.slice(PAGE_SIZE), collection);
}

/** clips コレクションを用意して、その strongRef と session を返す */
async function ensureCollection(
  session: Session,
): Promise<{ readonly session: Session; readonly ref: StrongRef }> {
  const r = await applyWrites(session, [collectionWrite()]);
  return { session: r.session, ref: strongRef(r.results[0]) };
}

async function main(): Promise<void> {
  const args = process.argv.slice(ARGV_OFFSET);
  const flags = new Map<string, Mode>([
    ["--dry-run", "dry-run"],
    ["--delete", "delete"],
  ]);
  if (args.length > 1 || args.some((a) => !flags.has(a))) usage();
  const mode = flags.get(args[0] ?? "") ?? "write";

  const session = mode === "dry-run" ? null : await createSession();
  const prepared =
    session !== null && mode === "write"
      ? await ensureCollection(session)
      : null;
  const done = await run(mode, 0, prepared?.session ?? session, {
    seen: 0,
    written: 0,
    lines: [],
    pending: [],
  });
  const totals = done.totals;
  if (prepared && done.session && totals.pending.length > 0) {
    console.error(
      `clip-semble: URL カードを書いた。${SETTLE_MS / MS_PER_SECOND} 秒待ってから NOTE と link を書く`,
    );
    await sleep(SETTLE_MS);
    await writeFollowUps(done.session, totals.pending, prepared.ref);
  }

  const verbs = new Map<Mode, string>([
    ["write", "wrote"],
    ["dry-run", "would write"],
    ["delete", "deleted"],
  ]);
  const skipped = totals.lines.filter((l) => l.startsWith("skip")).length;
  console.log(
    `${totals.seen} clips, ${verbs.get(mode)} ${totals.written}, skipped ${skipped}`,
  );
  totals.lines.forEach((l) => console.log(l));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
