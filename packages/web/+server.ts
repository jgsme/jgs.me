import type { Server } from "vike/types";
import { Hono } from "hono";
import vike from "@vikejs/hono";
import type { Bindings } from "./server/types";
import { createCacheMiddleware } from "./server/cache";
import { redirects } from "./server/routes/redirects";
import { rss } from "./server/routes/rss";
import { robots } from "./server/routes/robots";
import { random } from "./server/routes/random";
import { wellknown } from "./server/routes/wellknown";
import { objects } from "./server/routes/objects";
import { reactions } from "./server/routes/reactions";
import { internal } from "./server/routes/internal";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/", createCacheMiddleware(86400));
app.use("/pages/*", createCacheMiddleware(86400));
app.use("/a/*", createCacheMiddleware(604800));
app.use("/p/*", createCacheMiddleware(604800));

app.route("/", redirects);
app.route("/", rss);
app.route("/", robots);
app.route("/", random);
app.route("/", wellknown);
app.route("/", objects);
app.route("/", reactions);
app.route("/", internal);

vike(app);

export default { fetch: app.fetch } satisfies Server;
