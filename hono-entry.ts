import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { vikeHandler } from "./server/vike-handler";
import { postPageCreate } from "@/api/page/create/post";
import { postArticleCreate } from "@/api/article/create/post";

export type Bindings = {
  DB: D1Database;
};

type Middleware<Context extends Record<string | number | symbol, unknown>> = (
  request: Request,
  context: Context
) => Response | void | Promise<Response> | Promise<void>;

export function handlerAdapter<
  Context extends Record<string | number | symbol, unknown>
>(handler: Middleware<Context>) {
  return createMiddleware(async (context, next) => {
    let ctx = context.get("context");
    if (!ctx) {
      ctx = {
        env: context.env,
      };
      context.set("context", ctx);
    }

    const res = await handler(context.req.raw, ctx as Context);
    context.set("context", ctx);

    if (!res) {
      await next();
    }

    return res;
  });
}

const app = new Hono<{ Bindings: Bindings }>();

app.post("/api/page/create", postPageCreate);
app.post("/api/article/create", postArticleCreate);
app.all("*", handlerAdapter(vikeHandler));

export default app;
