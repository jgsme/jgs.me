import { desc, eq } from "drizzle-orm";
import { zets } from "@jigsaw/db";
import type { getDB } from "@/db/getDB";

// 本文は zet を題 (zet.title) でリンクするが、zet の page.title は
// zet:<rkey> なので /pages/<題> では page が引けない。題から zet を引く。
// zet.title に unique 制約は無い。重なったら新しい日の方を返す。
export async function findZetRkeyByTitle(
  db: ReturnType<typeof getDB>,
  title: string,
): Promise<string | null> {
  const rows = await db
    .select({ rkey: zets.rkey })
    .from(zets)
    .where(eq(zets.title, title))
    .orderBy(desc(zets.date), desc(zets.id))
    .limit(1);
  return rows[0]?.rkey ?? null;
}
