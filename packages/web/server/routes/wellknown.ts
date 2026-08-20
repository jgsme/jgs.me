import { Hono } from "hono";
import type { Bindings } from "../types";

const wellknown = new Hono<{ Bindings: Bindings }>();

// WebFinger は identity domain (w.jgs.me) から返す必要がある。
// ActivityPub の各エンドポイントも同様に公開ホスト名で見える必要があるため、
// web が受けて ap へそのまま転送する。
// Accept ヘッダと署名ヘッダを保つため、リクエストは加工しない。
for (const path of [
  "/.well-known/webfinger",
  "/.well-known/nodeinfo",
  "/nodeinfo/2.1",
]) {
  wellknown.all(path, (c) => c.env.AP.fetch(c.req.raw));
}

wellknown.all("/ap/*", (c) => c.env.AP.fetch(c.req.raw));

export { wellknown };
