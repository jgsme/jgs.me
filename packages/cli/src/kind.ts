import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CLIP_KINDS,
  parseKindArgs,
  parseKindCsv,
  type ClipKind,
} from "./kindArgs.ts";
import { buildKindUpdateSql } from "./kindSql.ts";

const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
const DATABASE_NAME = "w";

function usage(): never {
  console.error(
    [
      "usage: pnpm kind <url|id> <link|quote|photo|video>",
      "       pnpm kind --csv <path>",
      "",
      "  clip.kind を書き換える。clip でない page を指定しても何も起きない。",
      "",
      "  CSV は 1 行目をヘッダとして飛ばし、1 列目を pageID、2 列目を kind と",
      "  して読む。3 列目以降は無視する。",
      "",
      "  例: pnpm kind 1613 quote",
      "      pnpm kind https://w.jgs.me/p/1613 photo",
      "      pnpm kind --csv clip-kind-draft.csv",
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
    { cwd: WEB_DIR, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
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

function main(): void {
  const cmd = parseKindArgs(process.argv.slice(2));
  if (!cmd) usage();

  let rows: { id: number; kind: ClipKind }[];
  if (cmd.mode === "one") {
    rows = [{ id: cmd.id, kind: cmd.kind }];
  } else {
    let text: string;
    try {
      text = readFileSync(cmd.path, "utf8");
    } catch (e) {
      console.error(
        `CSV を読めなかった: ${cmd.path} (${e instanceof Error ? e.message : String(e)})`,
      );
      process.exit(1);
    }
    const parsed = parseKindCsv(text);
    // 読めない行があっても止めない。1665 行のうち数行が壊れているだけで
    // 全部やり直すのは損。ただし件数は必ず出す。
    for (const err of parsed.errors) console.error(err);
    if (parsed.errors.length > 0) {
      console.error(`(${parsed.errors.length} 行を飛ばした)`);
    }
    if (parsed.rows.length === 0) {
      console.error("更新できる行が 1 つも無い。");
      process.exit(1);
    }
    rows = parsed.rows;
  }

  const counts = new Map<ClipKind, number>();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  console.log(
    `更新する: ${rows.length} 件 (` +
      CLIP_KINDS.filter((k) => counts.has(k))
        .map((k) => `${k} ${counts.get(k)}`)
        .join(", ") +
      ")",
  );

  try {
    runSql(buildKindUpdateSql(rows));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
    return;
  }
  console.log("更新した。");
}

main();
