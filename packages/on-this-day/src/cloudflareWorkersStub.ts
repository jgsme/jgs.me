// vitest 用のスタブ。"cloudflare:workers" は workerd ランタイムの組み込みモジュールで、
// このリポジトリには @cloudflare/vitest-pool-workers が入っていないため、
// 素の vitest からは解決できない (実行時は wrangler/workerd が本物を解決する)。
// vitest.config.ts の resolve.alias で "cloudflare:workers" をこのファイルに差し替え、
// index.ts の import 文自体は評価できるようにする。dateFromEntry など純粋関数のテストが
// 目的で、WorkflowEntrypoint の実際の動作はここでは検証しない。
export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
  ctx: unknown;
  env: Env;
  constructor(ctx?: unknown, env?: Env) {
    this.ctx = ctx;
    this.env = env as Env;
  }
}

export type WorkflowEvent<Params> = {
  payload: Params;
};

export type WorkflowStep = {
  do: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
};
