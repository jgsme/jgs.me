import type { PageContextServer } from "vike/types";
import { render } from "vike/abort";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sharedImages } from "@jigsaw/db";
import { MEDIA_BASE_URL } from "../../src/config";
import { findObject } from "../../src/media";

type Context = PageContextServer & {
  env: { DB: D1Database; MEDIA: R2Bucket };
  routeParams: { id: string };
};

export type ImageData = {
  id: string;
  ext: string;
  direct: string;
  width: number | null;
  height: number | null;
  created: string;
};

const data = async (c: Context): Promise<ImageData> => {
  const id = c.routeParams.id;

  const [row] = await drizzle(c.env.DB)
    .select()
    .from(sharedImages)
    .where(eq(sharedImages.id, id))
    .limit(1);

  // 消した後も 200 を返すと unfurl 側に空のカードが焼かれる。
  if (row?.deletedAt) throw render(404);

  // 行が無くても w-media にあればページにする。拡張から投稿していない
  // 画像 (micropub / Gyazo 由来) を i.jgs.me で配るため。r2.jgs.me で
  // 元から公開されているので、ページにしても見える範囲は変わらない。
  if (!row) {
    const obj = await findObject(c.env.MEDIA, id);
    if (obj === null) throw render(404);
    return {
      id,
      ext: obj.ext,
      direct: `${MEDIA_BASE_URL}/${id}.${obj.ext}`,
      width: null,
      height: null,
      created: obj.created,
    };
  }

  return {
    id: row.id,
    ext: row.ext,
    direct: `${MEDIA_BASE_URL}/${row.id}.${row.ext}`,
    width: row.width,
    height: row.height,
    created: row.created,
  };
};

export default data;
