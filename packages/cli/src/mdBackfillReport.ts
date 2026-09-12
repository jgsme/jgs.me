/** ingest の MdBackfillItem (packages/ingest/src/mdBackfill.ts) と同じ形 */
export type MdBackfillItem = {
  pageId: number;
  title: string;
  written: boolean;
  error?: string;
};

export function formatMdBackfillReport(items: MdBackfillItem[]): string {
  const errored = items.filter((i) => i.error !== undefined);
  const written = items.filter((i) => i.written).length;
  // 本文が R2 に無い page は実在する。エラーではないので分けて数えるが、
  // どれが欠けているかは知りたいので列挙する。
  const skipped = items.filter((i) => !i.written && i.error === undefined);

  const lines = [`書いた: ${written}`];
  if (skipped.length > 0) {
    lines.push(
      "",
      "本文が無くて飛ばした page:",
      ...skipped.map((i) => `  ${i.pageId} ${i.title}`),
    );
  }
  if (errored.length > 0) {
    lines.push(
      "",
      "書けなかった page:",
      ...errored.map((i) => `  ${i.pageId} ${i.title}: ${i.error}`),
    );
  }
  return lines.join("\n");
}

// サーバの既定 limit (packages/ingest/src/mdBackfill.ts) と揃える。
export const SERVER_DEFAULT_LIMIT = 50;
