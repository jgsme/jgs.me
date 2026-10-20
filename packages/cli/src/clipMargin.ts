import { deletesFor, reportLines, writesFor } from "./clipMarginWrites.ts";
import {
  applyWrites,
  createSession,
  fetchNotes,
  type Session,
} from "./pdsClient.ts";

// Margin で作った「clips」コレクション。サイトに出す clip はこの中身。
const DEFAULT_COLLECTION =
  "at://did:web:ds.jgs.me/at.margin.collection/3mybpszk6ns2v";
// 1 回で 50 clip = 100 write。dirig の applyWrites の上限は 200。
const PAGE_SIZE = 50;
const ARGV_OFFSET = 2;

type Mode = "write" | "dry-run" | "delete";

function usage(): never {
  console.error(
    [
      "usage: pnpm clip-margin [--dry-run | --delete]",
      "",
      "  clip を Margin の at.margin.note として PDS (ds.jgs.me) に書き、",
      "  clips コレクションに入れる (at.margin.collectionItem)。",
      "",
      "  rkey は clip から決まるので、何度流しても同じ record を上書きするだけ。",
      "  出典 URL を拾えなかった clip は書かずに skip として標準出力に出す。",
      "",
      "  --dry-run  PDS に書かず、変換結果の集計と skip / warn だけ出す",
      "  --delete   書いた note と collectionItem を消す。Margin に届け直すときは",
      "             これを流してから、付けずにもう一度流す",
      "",
      "  環境変数: INGEST_URL / SIMILARITY_TOKEN",
      "            PDS_IDENTIFIER / PDS_PASSWORD (--dry-run では不要)",
      "            PDS_URL (既定 https://ds.jgs.me)",
      "            MARGIN_COLLECTION (既定 clips コレクションの at-uri)",
    ].join("\n"),
  );
  process.exit(1);
}

type Totals = {
  readonly seen: number;
  readonly written: number;
  readonly lines: readonly string[];
};

async function run(
  mode: Mode,
  cursor: number,
  session: Session | null,
  totals: Totals,
): Promise<Totals> {
  const r = await fetchNotes(cursor, PAGE_SIZE);
  const collection = process.env.MARGIN_COLLECTION ?? DEFAULT_COLLECTION;
  const writable = r.items.filter((i) => i.note !== undefined);
  const next =
    session === null
      ? null
      : (
          await applyWrites(
            session,
            writable.flatMap((i) =>
              mode === "delete"
                ? deletesFor(i)
                : writesFor(i, session.did, collection),
            ),
          )
        ).session;

  const seen = totals.seen + r.processed;
  console.error(`clip-margin: ${seen} clips (${mode})`);
  const after: Totals = {
    seen,
    written: totals.written + writable.length,
    lines: [...totals.lines, ...reportLines(r.items)],
  };
  return r.nextCursor === null ? after : run(mode, r.nextCursor, next, after);
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
  const totals = await run(mode, 0, session, {
    seen: 0,
    written: 0,
    lines: [],
  });

  const verbs = new Map<Mode, string>([
    ["write", "wrote"],
    ["dry-run", "would write"],
    ["delete", "deleted"],
  ]);
  const verb = verbs.get(mode);
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
