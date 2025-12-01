import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { getDB } from "@/db/getDB";
import { pages } from "@jigsaw/db";
import { eq } from "drizzle-orm";
import { redirect } from "vike/abort";

type Context = PageContextServer & {
  env: Bindings;
  routeParams: { id: string };
};

const data = async (c: Context) => {
  const id = Number(c.routeParams.id);
  if (isNaN(id)) {
    throw redirect("/");
  }

  const db = getDB(c.env.DB);
  const result = await db
    .select({ title: pages.title })
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].title) {
    throw redirect("/");
  }

  throw redirect(`/pages/${encodeURIComponent(result[0].title)}`);
};

export default data;
