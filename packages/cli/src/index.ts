import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  formatPartialResult,
  formatResult,
  hasRegistrations,
  parseChanges,
  parseRows,
} from "./format.ts";
import { parseTarget } from "./parse.ts";
import {
  buildDeleteSql,
  buildSelectSql,
  TARGET_TABLES,
  type TargetTable,
} from "./sql.ts";

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

/** wrangler を 1 回起動して --json の出力をパースして返す。失敗は例外 */
function runSql(sql: string): unknown {
  const proc = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      DATABASE_NAME,
      "--remote",
      "--command",
      sql,
      "--json",
    ],
    {
      cwd: WEB_DIR,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    },
  );

  if (proc.error) {
    throw new Error(`wrangler の起動に失敗した: ${proc.error.message}`);
  }
  if (proc.status !== 0) {
    throw new Error(
      `wrangler が失敗した (exit ${proc.status}):\n${proc.stdout ?? ""}`,
    );
  }

  try {
    return JSON.parse(proc.stdout);
  } catch {
    throw new Error(
      `wrangler の出力を JSON として読めなかった:\n${proc.stdout}`,
    );
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
    } else if (!ids.includes(id)) {
      // 同じ page を URL と裸の ID で 2 回渡されても 1 回として扱う
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

  let rows: Record<string, unknown>[];
  let needsDelete: boolean;
  try {
    rows = parseRows(runSql(buildSelectSql(ids)));
    needsDelete = hasRegistrations(rows);
  } catch (e) {
    console.error(message(e));
    console.error("削除は実行していない。");
    process.exitCode = 1;
    return;
  }

  const changesByTable: Record<TargetTable, number> = {
    article: 0,
    clip: 0,
    excluded_page: 0,
  };

  if (needsDelete) {
    for (const table of TARGET_TABLES) {
      try {
        changesByTable[table] = parseChanges(
          runSql(buildDeleteSql(table, ids)),
        );
      } catch (e) {
        console.error(message(e));
        console.error(
          `${table} の DELETE で失敗した。この DELETE 自体と、それより前のテーブルの削除は既に実行済みの可能性がある。`,
        );
        console.error("対象だった page:");
        console.log(formatPartialResult(ids, rows));
        process.exitCode = 1;
        return;
      }
    }
  }

  console.log(formatResult(ids, rows, changesByTable));
}

main();
