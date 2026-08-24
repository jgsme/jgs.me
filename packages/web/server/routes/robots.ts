import { Hono } from "hono";
import type { Bindings } from "../types";

const robots = new Hono<{ Bindings: Bindings }>();

// /search はクエリ次第で URL が無限に増えるが、中身は既存ページの再掲。
// クロールさせても新しく見つかるものが無いので閉じる。
const body = `User-agent: *
Allow: /
Disallow: /search
`;

robots.get("/robots.txt", (c) =>
  c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8" }),
);

export { robots };
