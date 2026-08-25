import type { Context, Next } from "hono";

/**
 * HEAD のとき、下流から見える生の Request を GET に差し替える。
 *
 * vike-photon は vike のハンドラを universal-middleware のルーターに
 * `method: "GET"` だけで登録する (ビルド後の renderPageHandler)。そのルーターは
 * Hono の Context ではなく `c.req.raw` の method で引く。Hono は HEAD を GET として
 * dispatch するのでハンドラまでは届くが、raw が HEAD のままなのでルーターが外し、
 * Hono の notFound (404) が返っていた。vike が描くページは HEAD だと軒並みこれになる。
 *
 * body を落とすのは Hono 側がやる (HEAD の dispatch 結果を `new Response(null, res)`
 * で包む) ので、ここでは method を見せ替えるだけでいい。
 */
export async function headAsGet(c: Context, next: Next) {
  if (c.req.raw.method === "HEAD") {
    (c.req as { raw: Request }).raw = new Request(c.req.raw, { method: "GET" });
  }
  await next();
}
