import { Hono } from "hono";
import type { Env } from "./db";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text("ok"));

export default app;
