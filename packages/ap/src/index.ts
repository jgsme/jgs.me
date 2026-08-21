import { Hono } from "hono";
import type { Env } from "./db";
import { webfinger } from "./routes/webfinger";
import { actor } from "./routes/actor";
import { nodeinfo } from "./routes/nodeinfo";
import { inbox } from "./routes/inbox";
import { objectRoute } from "./routes/object";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text("ok"));
app.route("/", webfinger);
app.route("/", actor);
app.route("/", nodeinfo);
app.route("/", inbox);
app.route("/", objectRoute);

export default app;
