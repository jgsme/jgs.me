import { Hono } from "hono";
import type { Env } from "../db";
import { buildActor } from "../actor";

const actor = new Hono<{ Bindings: Env }>();

actor.get("/ap/actor", (c) =>
  c.json(buildActor(c.env.AP_PUBLIC_KEY), 200, {
    "Content-Type": "application/activity+json",
  }),
);

export { actor };
