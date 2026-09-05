import type { PageContextServer } from "vike/types";
import { render } from "vike/abort";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sharedImages } from "@jigsaw/db";
import { useConfig } from "vike-react/useConfig";
import { MEDIA_BASE_URL } from "../../src/config";
import { sourceLink, type SourceLink } from "../../src/page";

type Context = PageContextServer & {
  env: { DB: D1Database };
  routeParams: { id: string };
};

export type ImageData = {
  id: string;
  ext: string;
  direct: string;
  width: number | null;
  height: number | null;
  created: string;
  source: SourceLink | null;
};

const data = async (c: Context): Promise<ImageData> => {
  const config = useConfig();
  const id = c.routeParams.id;

  const [row] = await drizzle(c.env.DB)
    .select()
    .from(sharedImages)
    .where(eq(sharedImages.id, id))
    .limit(1);

  // 行は消えうる (DELETE /api/images/:id)。消えた後も 200 を返すと
  // unfurl 側に空のカードが焼かれる。
  if (!row) throw render(404);

  // 題が無い画像もある。og:title を空にすると unfurl のカードが無題になる。
  config({ title: row.sourceTitle ?? "jgs.me" });

  return {
    id: row.id,
    ext: row.ext,
    direct: `${MEDIA_BASE_URL}/${row.id}.${row.ext}`,
    width: row.width,
    height: row.height,
    created: row.created,
    source: sourceLink(row.sourceURL, row.sourceTitle),
  };
};

export default data;
