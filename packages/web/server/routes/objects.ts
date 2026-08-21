import { Hono } from "hono";
import type { Bindings } from "../types";

const objects = new Hono<{ Bindings: Bindings }>();

// /o/:id は ActivityPub の正準 id。Accept ヘッダで AS2 と redirect が切り替わるため、
// edge cache を掛けずに ap worker へそのまま転送する。
objects.all("/o/:id", (c) => c.env.AP.fetch(c.req.raw));

export { objects };
