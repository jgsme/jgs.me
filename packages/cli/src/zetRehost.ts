type Item = {
  pageId: number;
  rkey: string;
  blobs: number;
  rehosted: number;
  error?: string;
};

type Envelope = {
  processed: number;
  nextCursor: number | null;
  items: Item[];
};

function usage(): never {
  console.error(
    [
      "usage: pnpm zet-rehost",
      "",
      "  取り込み済みの zet の画像を PDS (ds.jgs.me) の blob から w-media に写し、",
      "  本文と page.image を r2.jgs.me の URL に差し替える。",
      "",
      "  同じ blob は同じキーに落ちるので、何度流しても壊れない。",
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

async function call(cursor: number): Promise<Envelope> {
  const res = await fetch(`${env("INGEST_URL")}/internal/zet-rehost`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SIMILARITY_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor }),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as Envelope;
}

async function main(): Promise<void> {
  if (process.argv.slice(2).length > 0) usage();

  let cursor = 0;
  let seen = 0;
  let rehosted = 0;
  const left: Item[] = [];

  for (;;) {
    const r = await call(cursor);
    seen += r.processed;
    for (const item of r.items) {
      rehosted += item.rehosted;
      if (item.error !== undefined || item.rehosted < item.blobs) {
        left.push(item);
      }
    }
    console.error(`zet-rehost: ${seen} zets`);
    if (r.nextCursor === null) break;
    cursor = r.nextCursor;
  }

  console.log(`${seen} zets, ${rehosted} blobs rehosted`);
  for (const item of left) {
    console.log(
      `left page=${item.pageId} rkey=${item.rkey} ${item.rehosted}/${item.blobs}${
        item.error !== undefined ? ` error=${item.error}` : ""
      }`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
