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

type Mode = "write" | "dry-run" | "delete";

type Totals = {
  readonly seen: number;
  readonly written: number;
  readonly lines: readonly string[];
};

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

async function writePage(
  session: Session,
  clips: readonly SembleClip[],
  collection: StrongRef,
): Promise<Session> {
  const cards = await applyWrites(session, clips.map(urlCardWrite));
  const rest = clips.flatMap((c, i) =>
    followUpWrites(
      c,
      strongRef(cards.results[i]),
      collection,
      cards.session.did,
    ),
  );
  return (await applyWrites(cards.session, rest)).session;
}

async function deletePage(
  session: Session,
  clips: readonly SembleClip[],
): Promise<Session> {
  return (await applyWrites(session, clips.flatMap(deleteWrites))).session;
}

function apply(
  mode: Mode,
  session: Session,
  clips: readonly SembleClip[],
  collection: StrongRef | null,
): Promise<Session> {
  if (mode === "delete") return deletePage(session, clips);
  return writePage(session, clips, strongRef(collection ?? undefined));
}

function truncatedLines(clips: readonly SembleClip[]): readonly string[] {
  return clips
    .filter((c) => c.truncated)
    .map((c) => `warn\tc/${c.clipId}\tNOTE カードの本文を切り詰めた`);
}

async function run(
  mode: Mode,
  cursor: number,
  session: Session | null,
  collection: StrongRef | null,
  totals: Totals,
): Promise<Totals> {
  const r = await fetchNotes(cursor, PAGE_SIZE);
  const clips = r.items
    .map(toSembleClip)
    .filter((c): c is SembleClip => c !== null);

  const next =
    session === null ? null : await apply(mode, session, clips, collection);

  const seen = totals.seen + r.processed;
  console.error(`clip-semble: ${seen} clips (${mode})`);
  const after: Totals = {
    seen,
    written: totals.written + clips.length,
    lines: [...totals.lines, ...reportLines(r.items), ...truncatedLines(clips)],
  };
  return r.nextCursor === null
    ? after
    : run(mode, r.nextCursor, next, collection, after);
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
  const totals = await run(
    mode,
    0,
    prepared?.session ?? session,
    prepared?.ref ?? null,
    { seen: 0, written: 0, lines: [] },
  );

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
