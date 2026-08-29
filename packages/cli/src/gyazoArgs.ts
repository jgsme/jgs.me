export type GyazoCommand = "scan" | "fetch" | "rewrite";

export type GyazoArgs = {
  command: GyazoCommand;
  maxPages: number | null;
};

// undefined = フラグごと無い / null = フラグはあるが値が無い。
// この 2 つを区別しないと `--pages` の打ちかけを既定値として飲んでしまう。
function flagValue(argv: string[], name: string): string | null | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1] ?? null;
}

export function parseGyazoArgs(argv: string[]): GyazoArgs | null {
  const command = argv[0];
  if (command !== "scan" && command !== "fetch" && command !== "rewrite") {
    return null;
  }

  let maxPages: number | null = null;
  const pages = flagValue(argv, "--pages");
  if (pages !== undefined) {
    // --pages 0 を通すと rewrite が 1 ページも処理しないまま完了と出る。
    // 打ち間違いを黙って飲まず、usage を出して止める。
    const n = Number(pages);
    if (!Number.isInteger(n) || n < 1) return null;
    maxPages = n;
  }

  return { command, maxPages };
}
