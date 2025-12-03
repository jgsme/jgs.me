import { Hono } from "hono";
import { apply, serve } from "@photonjs/hono";
import type { Bindings } from "./types";
import { api } from "./routes/api";
import { redirects } from "./routes/redirects";
import { rss } from "./routes/rss";

export type { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/api", api);
app.route("/", redirects);
app.route("/", rss);

apply(app);
export default serve(app);
