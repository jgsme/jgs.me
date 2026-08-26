// ingest 側の同名の型と揃える。cli は ingest をワークスペース依存に持たないので
// import できない。ingest 側の型を変えたらここも変える。
export type ScanItem = {
  pageId: number;
  title: string;
  hashes: string[];
  imageHash: string | null;
  scrapboxFiles: number;
  error?: string;
};

export type ProbeItem = {
  gyazoHash: string;
  status: number;
  bytes: number | null;
  contentType: string | null;
};

export type FetchItem =
  | { gyazoHash: string; r2Key: string; bytes: number; contentType: string }
  | { gyazoHash: string; error: string };

export type RewriteItem = {
  pageId: number;
  title: string;
  replaced: number;
  skipped: number;
  imageReplaced: boolean;
};

export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) {
    out.push(xs.slice(i, i + size));
  }
  return out;
}

// 本文と page.image の両方を打診の対象にする。
export function uniqueHashes(items: ScanItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    for (const h of item.hashes) seen.add(h);
    if (item.imageHash !== null) seen.add(item.imageHash);
  }
  return [...seen];
}

export function formatScanReport(
  items: ScanItem[],
  probes: ProbeItem[],
): string {
  const hashes = uniqueHashes(items);
  const refs = items.reduce((n, i) => n + i.hashes.length, 0);
  const withGyazo = items.filter(
    (i) => i.hashes.length > 0 || i.imageHash !== null,
  ).length;
  const imageIsGyazo = items.filter((i) => i.imageHash !== null).length;
  const scrapboxFiles = items.reduce((n, i) => n + i.scrapboxFiles, 0);

  const byStatus = new Map<number, number>();
  for (const p of probes) {
    byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  }

  const totalBytes = probes
    .filter((p) => p.status === 200)
    .reduce((n, p) => n + (p.bytes ?? 0), 0);

  // どの記事から参照されているかが分からないと手で追えない。
  const sources = new Map<string, ScanItem[]>();
  for (const item of items) {
    const all = [...item.hashes];
    if (item.imageHash !== null) all.push(item.imageHash);
    for (const h of all) {
      const list = sources.get(h) ?? [];
      list.push(item);
      sources.set(h, list);
    }
  }

  const lines: string[] = [
    `対象 article: ${items.length}`,
    `Gyazo を含む article: ${withGyazo}`,
    `ユニーク画像: ${hashes.length}`,
    `延べ参照: ${refs}`,
    `page.image が Gyazo: ${imageIsGyazo}`,
    `scrapbox.io/files: ${scrapboxFiles}`,
    `総バイト: ${totalBytes}`,
    "",
    "HEAD status:",
    ...[...byStatus.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([status, n]) => `  ${status}: ${n}`),
  ];

  const failed = probes.filter((p) => p.status !== 200);
  if (failed.length > 0) {
    lines.push("", "取得できない画像:");
    for (const p of failed) {
      const from = (sources.get(p.gyazoHash) ?? [])
        .map((i) => `${i.pageId} ${i.title}`)
        .join(", ");
      lines.push(`  ${p.gyazoHash} (${p.status}) <- ${from}`);
    }
  }

  const broken = items.filter((i) => i.error !== undefined);
  if (broken.length > 0) {
    lines.push("", "本文を読めなかった page:");
    for (const i of broken) {
      lines.push(`  ${i.pageId} ${i.title}: ${i.error}`);
    }
  }

  return lines.join("\n");
}
