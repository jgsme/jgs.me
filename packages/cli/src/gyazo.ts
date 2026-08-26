import {
  chunk,
  formatScanReport,
  nextLimit,
  uniqueHashes,
  type FetchItem,
  type ProbeItem,
  type RewriteItem,
  type ScanItem,
} from "./gyazoReport.ts";

// probe / fetch の 1 回あたりの上限。ingest 側の PROBE_MAX / FETCH_MAX と揃える。
const PROBE_MAX = 40;
const FETCH_MAX = 10;

function usage(): never {
  console.error(
    [
      "usage: pnpm gyazo <scan|fetch|rewrite> [--pages N]",
      "",
      "  scan    棚卸し。書き込みなし。走査 + HEAD 打診をしてレポートを出す",
      "  fetch   取り込み。Gyazo → R2 (w-media) + 対応表への記録",
      "  rewrite 差し替え。本文と page.image を書き換える (破壊的)",
      "",
      "  --pages N  rewrite で処理する page 数の上限",
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

// どのフェーズもこの封筒で返す。items の中身だけがフェーズごとに違う。
type Envelope<T> = {
  processed: number;
  nextCursor: number | null;
  items: T[];
};

async function call<T>(body: Record<string, unknown>): Promise<Envelope<T>> {
  const res = await fetch(`${env("INGEST_URL")}/internal/gyazo-migrate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SIMILARITY_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as Envelope<T>;
}

// cursor が尽きるまで回して items を全部集める。
async function walk<T>(
  phase: "scan" | "rewrite",
  maxPages: number | null,
): Promise<T[]> {
  const items: T[] = [];
  let cursor = 0;
  let seen = 0;
  for (;;) {
    // limit を送らないとサーバが既定の 20 件を先に処理してから返ってくるので、
    // --pages が rewrite の安全弁として機能しない (破壊的な書き込みが先に走る)。
    const r = await call<T>({
      phase,
      cursor,
      limit: nextLimit(maxPages, seen),
    });
    items.push(...r.items);
    seen += r.processed;
    console.error(`${phase}: ${seen} pages`);
    if (r.nextCursor === null) break;
    if (maxPages !== null && seen >= maxPages) break;
    cursor = r.nextCursor;
  }
  return items;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command !== "scan" && command !== "fetch" && command !== "rewrite") {
    usage();
  }

  const pagesFlag = args.indexOf("--pages");
  const maxPages = pagesFlag === -1 ? null : Number(args[pagesFlag + 1]);
  if (maxPages !== null && !Number.isFinite(maxPages)) usage();

  if (command === "scan") {
    const items = await walk<ScanItem>("scan", null);
    const probes: ProbeItem[] = [];
    for (const group of chunk(uniqueHashes(items), PROBE_MAX)) {
      const r = await call<ProbeItem>({ phase: "probe", hashes: group });
      probes.push(...r.items);
      console.error(`probe: ${probes.length} images`);
    }
    console.log(formatScanReport(items, probes));
    return;
  }

  if (command === "fetch") {
    // 取り込む対象は棚卸しと同じ集合。scan をもう一度回して拾い直す。
    const items = await walk<ScanItem>("scan", null);
    let ok = 0;
    const errors: string[] = [];
    for (const group of chunk(uniqueHashes(items), FETCH_MAX)) {
      const r = await call<FetchItem>({ phase: "fetch", hashes: group });
      for (const item of r.items) {
        if ("error" in item) {
          errors.push(`${item.gyazoHash}: ${item.error}`);
        } else {
          ok++;
        }
      }
      console.error(`fetch: ok ${ok} / error ${errors.length}`);
    }
    console.log(`取り込み成功: ${ok}`);
    if (errors.length > 0) {
      console.log(`取り込み失敗: ${errors.length}`);
      for (const e of errors) console.log(`  ${e}`);
    }
    return;
  }

  const items = await walk<RewriteItem>("rewrite", maxPages);
  const touched = items.filter((i) => i.replaced > 0 || i.imageReplaced);
  const skipped = items.reduce((n, i) => n + i.skipped, 0);
  console.log(`書き換えた page: ${touched.length}`);
  console.log(`置換した URL: ${items.reduce((n, i) => n + i.replaced, 0)}`);
  console.log(`対応表に無くて残した URL: ${skipped}`);
  for (const i of touched) {
    console.log(`  ${i.pageId} ${i.title} (${i.replaced})`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
