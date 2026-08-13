import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatResult } from "./format.ts";
import { parseTarget } from "./parse.ts";
import { buildSql } from "./sql.ts";

const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
const DATABASE_NAME = "w";

function usage(): never {
  console.error(
    [
      "usage: pnpm undo <url|id> [<url|id>...]",
      "",
      "  指定した page を article / clip / excluded_page から削除して",
      "  未登録状態に戻す。",
      "",
      "  例: pnpm undo https://w.jgsw.workers.dev/p/1613",
      "      pnpm undo 1613 1612",
    ].join("\n"),
  );
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  const ids: number[] = [];
  const invalid: string[] = [];
  for (const arg of args) {
    const id = parseTarget(arg);
    if (id === null) {
      invalid.push(arg);
    } else {
      ids.push(id);
    }
  }

  if (invalid.length > 0) {
    for (const arg of invalid) {
      console.error(`不正な引数: ${arg}`);
    }
    console.error("(/a/:id は article.id なので使えない。/p/:id を使う)");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "jgs-undo-"));
  const sqlPath = join(dir, "undo.sql");

  try {
    writeFileSync(sqlPath, buildSql(ids));

    const proc = spawnSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "d1",
        "execute",
        DATABASE_NAME,
        "--remote",
        "--file",
        sqlPath,
        "--json",
      ],
      { cwd: WEB_DIR, encoding: "utf8" },
    );

    if (proc.status !== 0) {
      process.stderr.write(proc.stderr ?? "");
      process.stdout.write(proc.stdout ?? "");
      process.exit(1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(proc.stdout);
    } catch {
      console.error("wrangler の出力を JSON として読めなかった:");
      process.stdout.write(proc.stdout);
      process.exit(1);
    }

    try {
      console.log(formatResult(ids, parsed));
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error("wrangler の生出力:");
      process.stdout.write(proc.stdout);
      process.exit(1);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
