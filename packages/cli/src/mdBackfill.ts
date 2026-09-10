import {
  formatMdBackfillReport,
  SERVER_DEFAULT_LIMIT,
  type MdBackfillItem,
} from "./mdBackfillReport.ts";

function usage(): never {
  console.error(
    [
      "usage: pnpm md-backfill",
      "",
      "  検索インデックス用の md (w-md) を既存ページぶん埋める。",
      "  対象は article か clip として登録されているページだけ。",
      "",
      "  同じキーに同じ内容を上書きするだけなので、何度流しても壊れない。",
      "  流し直しが要るのは toMarkdown の変換規則を変えたとき。",
      "",
      "  環境変数 INGEST_URL / SIMILARITY_TOKEN が要る。",
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

type Envelope = {
  processed: number;
  nextCursor: number | null;
  items: MdBackfillItem[];
};

async function call(cursor: number): Promise<Envelope> {
  const res = await fetch(`${env("INGEST_URL")}/internal/md-backfill`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SIMILARITY_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor, limit: SERVER_DEFAULT_LIMIT }),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as Envelope;
}

async function main(): Promise<void> {
  if (process.argv.slice(2).length > 0) usage();

  const items: MdBackfillItem[] = [];
  let cursor = 0;
  let seen = 0;

  // cursor が尽きるまで回す。1 件の失敗はサーバ側で items の error に入って
  // 返ってくるので、ここでは止めずに最後までなめる。
  for (;;) {
    const r = await call(cursor);
    items.push(...r.items);
    seen += r.processed;
    console.error(`md-backfill: ${seen} pages`);
    if (r.nextCursor === null) break;
    cursor = r.nextCursor;
  }

  console.log(formatMdBackfillReport(items));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
